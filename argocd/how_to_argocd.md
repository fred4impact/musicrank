# Deploying MusicRank with ArgoCD (GitOps)

Everything in `kubernetes/how_to_deploy.md` is **imperative**: you run
`kubectl apply`, in a specific order, by hand (or via a script), every
time something changes. This document covers the **declarative**
alternative — ArgoCD continuously watches this Git repo and keeps the
cluster matching whatever's committed, with no `kubectl apply` in the
loop at all once it's bootstrapped.

Both approaches deploy the exact same manifests in `kubernetes/` and
`monitoring/`. Nothing here duplicates them — ArgoCD just becomes the
thing that applies them, and keeps re-applying them forever.

---

## Why this matters (the part `kubectl apply` can't do)

Run this against a cluster deployed with plain `kubectl` and watch what
happens:

```bash
kubectl scale deployment vote-api --replicas=1 -n musicrank
```

With plain `kubectl`, that sticks — nothing reverts it until someone
notices and fixes it by hand. With ArgoCD managing `vote-api` and
`syncPolicy.automated.selfHeal: true` set (every Application in this repo
has it), the exact same command gets **silently reverted back to 3** within
about 30 seconds, with zero human involvement. This was tested live while
building this setup — see "Verifying it actually works" below for the
real before/after.

That's the actual point of GitOps: the cluster's state is continuously
reconciled against Git, not just set once. Git becomes the single source
of truth, and drift — accidental or malicious — gets corrected
automatically.

---

## Architecture: "app of apps"

```
argocd/root-app.yaml              <- the ONE thing you apply by hand
         |
         v
argocd/appsets/  (ArgoCD manages everything below from here on)
  |
  +-- project.yaml ................ AppProject (least-privilege scope)
  +-- bootstrap-application.yaml ... namespace + configmap
  +-- applicationset-infra.yaml .... generates: postgres, redis
  +-- applicationset-services.yaml . generates: vote-api, ranking-api,
  |                                             worker, frontend
  +-- applicationset-monitoring.yaml generates: prometheus, grafana
```

`root-app.yaml` is a plain ArgoCD `Application` pointed at the
`argocd/appsets/` directory. It applies everything in that directory —
including the three `ApplicationSet` resources, which are themselves
*generators* that each produce one child `Application` per matching
subdirectory under `kubernetes/` or `monitoring/`. Add a new service
later (`kubernetes/new-service/`) and it's picked up automatically — no
new YAML to write, no `root-app.yaml` change needed.

This nests three levels deep: `root-app` → `ApplicationSet` → generated
`Application` → actual Kubernetes resources (Deployments, Services, etc).
That's normal for this pattern, not a sign of over-engineering.

### Why three ApplicationSets instead of one

Each one carries a `sync-wave` annotation controlling the order ArgoCD
applies **root-app's direct children**:

| Wave | Resource | Why it goes here |
|---|---|---|
| -2 | `project.yaml` | Must exist before anything can reference `project: musicrank` |
| -1 | `musicrank-bootstrap` | Creates the namespace everything else deploys into |
| 0 | `musicrank-infra` (postgres, redis) | Everything else depends on these |
| 1 | `musicrank-services` (vote-api, ranking-api, worker, frontend) | Need infra up first |
| 2 | `musicrank-monitoring` (prometheus, grafana) | Prometheus scrapes the app pods — they should exist first |

**Honest limitation, not glossed over**: sync-wave only orders
`root-app`'s *direct* children (the AppProject, the bootstrap Application,
and the three `ApplicationSet` objects themselves). The individual
Applications each `ApplicationSet` generates — `vote-api`, `postgres`,
etc — are created by a separate controller loop, outside that single sync
operation, so there's no equivalent fine-grained ordering guarantee
between e.g. `vote-api` and `ranking-api` within the same wave. This
doesn't actually matter here: those services already tolerate a dependency
not being ready yet (see `kubernetes/study.md` Module 5 — readiness
probes, and the Phase 8 `pool.on("error", ...)` fix) for exactly this
reason. GitOps doesn't remove the need for resilient services; it just
automates convergence toward desired state around them.

---

## The Secret problem (read this before you deploy)

`kubernetes/secrets.yaml` is gitignored — it holds real Postgres
credentials and was **never pushed to GitHub**. ArgoCD only ever reads
from Git. It cannot see this file, full stop, no matter how its source
paths are configured.

This is why `argocd/appsets/bootstrap-application.yaml` explicitly
includes only `namespace.yaml` and `configmap.yaml` — never `secrets.yaml`
or `secrets.example.yaml`. The Secret stays a manual, out-of-band step,
identical to how `kubernetes/how_to_deploy.md` Stage 2 already handles it:

```bash
kubectl apply -f kubernetes/secrets.yaml
```

Run this **once**, before or after bootstrapping ArgoCD — order doesn't
matter here since Postgres/the app services will simply crash-loop (not
silently misbehave) until the Secret exists, and ArgoCD's `selfHeal` will
keep retrying them automatically once it does.

If you wanted a fully GitOps-managed secret for real (not just for this
local demo), the standard answers are **Sealed Secrets** (Bitnami — encrypt
the Secret so it's safe to commit, a controller decrypts it in-cluster) or
an **External Secrets Operator** pulling from a real vault. Neither is set
up here — out of scope for a local learning cluster with no KMS available,
and it would be genuinely new infrastructure, not a config tweak.

---

## Prerequisites

- Everything in `kubernetes/how_to_deploy.md`'s Stage 0 (cluster context)
- The `argocd` CLI (`brew install argocd` on macOS) — optional, but used
  below; everything it does can also be done with `kubectl` directly
  against the `Application`/`ApplicationSet` CRDs
- **The GitHub repo must be public**, or ArgoCD needs credentials — see
  "If your repo is private" below. (This project's repo is public.)

---

## Step 1 — Install ArgoCD

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml \
  --server-side --force-conflicts
```

**Use `--server-side --force-conflicts`, not plain `kubectl apply`.** The
`ApplicationSet` CRD is large enough that a normal client-side apply fails
with `metadata.annotations: Too long: must have at most 262144 bytes` —
hit this for real on the first install attempt. Server-side apply doesn't
have that annotation-size problem.

```bash
kubectl wait --for=condition=Available deployment --all -n argocd --timeout=120s
kubectl get pods -n argocd
```

All pods should be `1/1 Running` before continuing.

---

## Step 2 — Bootstrap everything with the root Application

```bash
kubectl apply -f argocd/root-app.yaml
```

This is the only manifest you ever apply by hand under normal operation.
Everything downstream — the AppProject, the bootstrap Application, the
three ApplicationSets, and the 8 Applications they generate — is created
and kept in sync automatically from here on.

```bash
kubectl get applications -n argocd
```

Give it 20-30 seconds, then expect to see 10 rows (root + bootstrap + 8
generated), all `Synced` / `Healthy`:

```
NAME                  SYNC STATUS   HEALTH STATUS
frontend              Synced        Healthy
grafana               Synced        Healthy
musicrank-bootstrap   Synced        Healthy
musicrank-root        Synced        Healthy
postgres              Synced        Healthy
prometheus            Synced        Healthy
ranking-api           Synced        Healthy
redis                 Synced        Healthy
vote-api              Synced        Healthy
worker                Synced        Healthy
```

If something's stuck on `Unknown` rather than `Synced`, don't wait it
out — that status means ArgoCD hit an error trying to even read the
manifests, not that it's still working. Go straight to Troubleshooting.

Don't forget the Secret from the section above — Postgres and the app
services won't come up `Healthy` without it.

---

## Step 3 — Access the UI and CLI

```bash
kubectl port-forward svc/argocd-server -n argocd 8080:443
```

Open https://localhost:8080 (self-signed cert — your browser will warn,
that's expected for a local install). Username `admin`, password:

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo
```

CLI, in a second terminal (needs the port-forward above running):

```bash
argocd login localhost:8080 --username admin --password <password from above> --insecure
argocd app list
```

`--insecure` here means "skip TLS certificate verification" (because it's
self-signed), not "skip authentication" — you still need the real
password.

---

## Verifying it actually works (not just that it deployed)

Anyone can declare `selfHeal: true` in YAML. Prove it actually does
something — this is the exact sequence run while building this setup:

```bash
# Before: confirm the Git-declared state
kubectl get deployment vote-api -n musicrank   # expect 3/3

# Drift: manually contradict Git
kubectl scale deployment vote-api --replicas=1 -n musicrank
kubectl get deployment vote-api -n musicrank   # now 1/1 — Kubernetes did exactly what was asked

# Wait ~30s for ArgoCD's next reconciliation pass, then:
kubectl get deployment vote-api -n musicrank   # back to 3/3, with nobody running kubectl apply
```

If you want to see it mid-correction rather than just before/after:

```bash
kubectl get deployment vote-api -n musicrank -w
```

in one terminal while you scale it down in another.

---

## Updating a running deployment via GitOps

No more `kubectl apply` after a code change — just push to the branch
ArgoCD is tracking:

```bash
# 1. Make your change (e.g. bump a service's image tag, same as
#    how_to_deploy.md's "Updating a running deployment" section)
# 2. Commit and push to the `feature` branch (or whatever targetRevision
#    the Applications point at — see "Switching to master" below)
git add .
git commit -m "..."
git push origin feature

# 3. ArgoCD notices on its next poll (default: every 3 minutes) and syncs
#    automatically. To see it immediately instead of waiting:
kubectl annotate application <app-name> -n argocd argocd.argoproj.io/refresh=hard --overwrite
```

Or via the CLI: `argocd app sync <app-name>`.

---

## Switching from `feature` to `master`

Every `targetRevision: feature` in `argocd/appsets/*.yaml` and
`argocd/root-app.yaml` is deliberate — this was built and tested against
the `feature` branch, matching where the work actually lives during
development. Once this is merged to `master`, update every
`targetRevision: feature` to `targetRevision: master` (or `HEAD`, which
always tracks whatever the default branch is) and push — ArgoCD will pick
up the new target on its next poll, the same self-healing mechanism as
any other change.

---

## Troubleshooting (real issues hit while building this)

- **`metadata.annotations: Too long`** during ArgoCD install — see Step 1.
  Use `--server-side --force-conflicts`.

- **`failed to list refs: authentication required: Repository not
  found`** on any Application — this is GitHub's actual 404 response for
  a private repo requested without credentials (not a typo'd URL). Either
  make the repo public, or register credentials:
  ```bash
  kubectl create secret generic musicrank-repo-creds -n argocd \
    --from-literal=type=git \
    --from-literal=url=https://github.com/<you>/musicrank.git \
    --from-literal=username=<github-username> \
    --from-literal=password=<personal-access-token>
  kubectl label secret musicrank-repo-creds -n argocd argocd.argoproj.io/secret-type=repository
  ```
  Never commit that credential anywhere — same treatment as
  `kubernetes/secrets.yaml`.

- **One Application stuck on sync status `Unknown` with `Object 'Kind' is
  missing in '{...}'`** — ArgoCD's plain directory source tries to parse
  *every* file in that path as a Kubernetes manifest. Hit this for real:
  `monitoring/grafana/musicrank-dashboard.json` has no `apiVersion`/`kind`
  (it's raw Grafana dashboard data, not a K8s object — see
  `monitoring/README.md`), which is exactly why
  `applicationset-monitoring.yaml`'s template has `directory.exclude:
  "*.json"`. If you add a new non-manifest file anywhere under a path an
  Application sources from, exclude it the same way.

- **An Application won't go `Healthy` even though `kubectl get pods`
  looks fine** — check whether it's actually `Synced` first
  (`kubectl get application <name> -n argocd`); a sync error blocks health
  evaluation entirely. `kubectl describe application <name> -n argocd` and
  read `Status.Conditions` — it names the exact file and error, same as
  the two issues above.

- **Pods crash-looping after a clean bootstrap** — almost certainly the
  Secret. See "The Secret problem" above; `kubectl get secret
  musicrank-secrets -n musicrank` should exist and have real values, not
  just the bootstrap's namespace/configmap.

---

## Tearing down

Removes ArgoCD's management, but — same as `how_to_deploy.md`'s own
teardown — the app's own ClusterRole/ClusterRoleBinding (Prometheus's,
kube-state-metrics') are cluster-scoped and need a separate delete:

```bash
kubectl delete -f argocd/root-app.yaml   # cascades to everything it manages (finalizer-driven)
kubectl delete namespace musicrank
kubectl delete clusterrole prometheus kube-state-metrics
kubectl delete clusterrolebinding prometheus kube-state-metrics
kubectl delete namespace argocd          # removes ArgoCD itself
```

`kubectl delete -f argocd/root-app.yaml` relies on the
`resources-finalizer.argocd.argoproj.io` finalizer already set on
`root-app.yaml` — that's what makes ArgoCD clean up everything it created
(the AppProject, the bootstrap Application, the ApplicationSets, and
everything *they* created) before the root Application object itself is
allowed to be removed, rather than orphaning it all.
