# Learning Kubernetes with MusicRank

A hands-on course that uses this repository as the lab. Every exercise runs
against the real, working deployment documented in `how_to_deploy.md` — not
toy YAML written for a tutorial. Where something broke while this project
was built, that bug is kept in as a lesson, because debugging a real
failure teaches more than reading a correct manifest ever does.

## Who this is for

Someone comfortable with Docker (`docker run`, a `Dockerfile`, basic
networking) who has never operated a Kubernetes cluster. No prior K8s
knowledge assumed. Each module builds on the last — do them in order the
first time through.

## How to use this guide

Each module has:
- **Concepts** — the minimum theory needed before the lab makes sense
- **Look at the file** — real manifests in this repo to read first
- **Lab** — commands to run against your own cluster
- **Break it on purpose** — a deliberate failure, because understanding
  *why* something breaks is how the concept actually sticks
- **Check your understanding** — questions with no answer key; you verify
  them yourself by running something and reading the result

You need a local cluster (Docker Desktop Kubernetes, minikube, or kind —
see `README.md`'s "Local prerequisites") and the images built per
`how_to_deploy.md` Stage 1 before Module 2 onward. Do Module 1 first either
way — it's reading, not hands-on.

---

## Course map

| # | Module | New concepts | Hands-on? |
|---|---|---|---|
| 1 | Why Kubernetes? | The problem K8s solves | No — read only |
| 2 | Pods, Deployments, ReplicaSets | The core workload objects | Yes |
| 3 | Services & cluster networking | Service discovery, ClusterIP vs LoadBalancer | Yes |
| 4 | ConfigMaps & Secrets | Separating config from code | Yes |
| 5 | Probes & self-healing | Liveness vs readiness | Yes |
| 6 | StatefulSets & storage | PVCs, stable identity | Yes |
| 7 | Scaling & rolling updates | Replicas, zero-downtime deploys | Yes |
| 8 | RBAC & service accounts | Least-privilege access to the API | Yes |
| 9 | Observability | Prometheus, Grafana, metrics-as-data | Yes |
| 10 | Capstone | Deploy the whole thing yourself, cold | Yes |

Appendix: every real bug hit while building this system, and what each one
teaches — worth reading after Module 9, before the capstone.

---

## Module 1 — Why Kubernetes?

### Concepts

You already know how to run this whole system with `docker compose up`
(see root `README.md`). That works great on one machine. Kubernetes exists
for the questions Compose doesn't answer:

- What happens when a container crashes at 3am? (Compose: nothing, until
  someone notices. Kubernetes: a controller notices within seconds and
  restarts it.)
- What if one machine isn't enough traffic capacity? (Compose: there is no
  "another machine." Kubernetes: schedule more replicas, possibly on
  other nodes.)
- How do you roll out a new version without downtime? (Compose: there
  isn't a built-in answer. Kubernetes: `RollingUpdate` — see Module 7.)
- How does a new replica find the database without being told its IP
  address? (Compose: a static hostname in one network. Kubernetes: the
  same idea, generalized to a whole cluster — see Module 3.)

Kubernetes's actual job is reconciliation: you declare a *desired state*
("3 copies of vote-api should be running"), and a set of controllers
continuously compares that to *actual state* and corrects any difference.
Every exercise in this course is really about watching that loop in
action — you'll change the desired state and watch Kubernetes notice and
react.

### Look at the file

Open `../docker-compose.yml` next to `kubernetes/vote-api/deployment.yaml`.
Same service, two different declarations of "how to run it." You'll spend
this course learning the right-hand column.

### Check your understanding

- In `docker-compose.yml`, what happens if you `docker kill` the `vote-api`
  container? Try it. Does anything bring it back?
- Skim `kubernetes/vote-api/deployment.yaml`'s `replicas:` field before
  Module 2 — what do you think that number controls?

---

## Module 2 — Pods, Deployments, ReplicaSets

### Concepts

- **Pod** — the smallest thing Kubernetes schedules. Usually one
  container (this project never uses more than one per Pod), plus shared
  network/storage. Pods are disposable — Kubernetes deletes and recreates
  them freely; never assume a specific Pod will still exist in five
  minutes.
- **ReplicaSet** — keeps N copies of a Pod template running. You never
  write these by hand in this project (or almost anywhere) — a Deployment
  creates and manages one for you.
- **Deployment** — a ReplicaSet manager that also understands *rolling
  updates* (Module 7). This is the object you actually write.

### Look at the file

`kubernetes/vote-api/deployment.yaml`. Identify:
- `spec.replicas` — the desired copy count
- `spec.selector.matchLabels` and `spec.template.metadata.labels` — these
  **must match**; it's how the Deployment finds the Pods it owns
- `spec.template.spec.containers[0].image` — note it's a specific tag
  (`musicrank-vote-api:v0.3.0`), not `:latest`. You'll learn exactly why
  in Module 7 and the Appendix — it's one of the real bugs.

### Lab

```bash
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/configmap.yaml
kubectl apply -f kubernetes/secrets.yaml   # cp secrets.example.yaml -> secrets.yaml first if you haven't
kubectl apply -f kubernetes/redis/
kubectl apply -f kubernetes/vote-api/

kubectl get deployment vote-api -n musicrank
kubectl get replicaset -n musicrank -l app=vote-api
kubectl get pods -n musicrank -l app=vote-api -o wide
```

Three different objects, three different jobs. Note the ReplicaSet's name
— it's the Deployment's name plus a hash of the Pod template. Change the
template (Module 7) and you'll get a *new* ReplicaSet, not a modified one.

### Break it on purpose

```bash
kubectl delete pod -n musicrank -l app=vote-api --field-selector status.phase=Running -o name | head -1 | xargs kubectl delete -n musicrank
kubectl get pods -n musicrank -l app=vote-api -w
```

Watch a replacement Pod appear within seconds, unprompted. Nothing you
did restarted it — the ReplicaSet controller noticed actual (2 Pods)
didn't match desired (3 Pods) and corrected it. This is the reconciliation
loop from Module 1, concretely.

### Check your understanding

- If you `kubectl delete deployment vote-api`, does the ReplicaSet survive?
  Does a Pod? (Try it, then `kubectl apply -f kubernetes/vote-api/` again.)
- `spec.selector` and the Pod template's `labels` matched by coincidence
  in this file — they're both `app: vote-api`. What would happen if you
  changed the label in `template.metadata.labels` but not `selector`?
  (Don't try this one against your real deployment — reason about it,
  then check the Kubernetes docs for "Deployment selector is immutable.")

---

## Module 3 — Services & cluster networking

### Concepts

A Pod's IP address is not stable — delete and recreate it (Module 2) and
it gets a new one. A **Service** is a stable name + IP that load-balances
across whichever Pods currently match its selector, updated automatically
as Pods come and go.

Two `type`s matter here:
- **ClusterIP** (the default) — reachable only from inside the cluster.
  For things nothing outside should touch directly: Postgres, Redis.
- **LoadBalancer** — also reachable from outside the cluster. On a cloud
  provider this provisions a real external load balancer; on Docker
  Desktop's local Kubernetes it's simulated by binding the port straight
  to `localhost` (see `kubernetes/README.md`'s "URLs" section for exactly
  how that mapping works, since it matters for the capstone).

### Look at the file

`kubernetes/postgres/statefulset.yaml`'s `Service` block (type unset =
`ClusterIP`) next to `kubernetes/vote-api/deployment.yaml`'s `Service`
block (`type: LoadBalancer`). Same shape, different `type:`, different
reachability.

### Lab

Service discovery inside the cluster works by DNS name — a Pod in the
`musicrank` namespace can reach Postgres at exactly the hostname
`postgres`, no IP address involved:

```bash
kubectl run -n musicrank dns-test --rm -it --restart=Never --image=busybox -- \
  nslookup postgres.musicrank.svc.cluster.local
```

Now look at `kubernetes/ranking-api/deployment.yaml`'s `DATABASE_URL` —
`postgres://musicrank:musicrank@postgres:5432/musicrank`. That `postgres`
hostname is exactly what you just resolved. ranking-api never needs to
know a Pod IP.

From outside the cluster, Docker Desktop's LoadBalancer binding means the
exact same service is also reachable as `localhost:4002` on your host —
check `curl http://localhost:4002/health`.

### Break it on purpose

```bash
kubectl scale deployment vote-api --replicas=0 -n musicrank
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4001/health
kubectl scale deployment vote-api --replicas=3 -n musicrank
```

With zero matching Pods, the Service still exists (`kubectl get svc
vote-api -n musicrank` — it's still there) but has nothing to route to.
`kubectl describe svc vote-api -n musicrank` and look at `Endpoints:` —
empty when scaled to 0, repopulated once Pods come back and pass their
readiness probe (next module).

### Check your understanding

- Why is Postgres's Service `ClusterIP` and not `LoadBalancer`? (Spec §18
  has the explicit reasoning — find it, then explain it in your own words.)
- `kubectl get endpoints vote-api -n musicrank` while all 3 Pods are
  healthy. How many IPs do you see, and how do they relate to
  `kubectl get pods -n musicrank -l app=vote-api -o wide`?

---

## Module 4 — ConfigMaps & Secrets

### Concepts

Baking config into a container image means rebuilding the image for every
environment. ConfigMaps and Secrets inject config at *runtime* instead —
same image, different environment variables depending on what's mounted.

The only real difference between them: Secrets are base64-encoded (not
encrypted by default — don't mistake this for real protection) and
Kubernetes treats them as more sensitive by convention (RBAC can restrict
read access to Secrets separately from ConfigMaps). The rule this project
follows: if it's a credential, it's a Secret; everything else is a
ConfigMap.

### Look at the file

`kubernetes/configmap.yaml` (non-sensitive) next to
`kubernetes/secrets.example.yaml` (credential shape, placeholder values —
never real ones, see its own header comment on why). Then
`kubernetes/ranking-api/deployment.yaml`'s `env:`/`envFrom:` block, which
pulls from both: `REDIS_URL` from the ConfigMap, `DATABASE_URL` from the
Secret.

Read the comment block at the top of `kubernetes/configmap.yaml` — it
explains a real design decision: this project's services take one
`DATABASE_URL` connection string (which embeds a password) rather than
separate host/user/password variables, so the *whole string* has to live
in the Secret, not split across both. That's a deliberate trade-off, not
an oversight — understand the reasoning, since "how do I structure config"
is a judgment call you'll make on every real project.

### Lab

```bash
kubectl exec -n musicrank deploy/ranking-api -- env | grep -E "REDIS_URL|DATABASE_URL"
```

One came from a ConfigMap, one from a Secret — same `env:`/`envFrom:`
mechanism from the Pod's point of view. Now look at the Secret itself:

```bash
kubectl get secret musicrank-secrets -n musicrank -o jsonpath='{.data.DATABASE_URL}' | base64 -d
```

That's `base64 -d`, not decryption — worth sitting with that fact for a
moment. A Secret restricts *who in the cluster can read it* via RBAC
(Module 8); it does nothing to hide the value from someone who already has
that access. Real production clusters usually pair Secrets with an
external secrets manager for anything truly sensitive — out of scope here,
but know it exists.

### Break it on purpose

`kubernetes/secrets.yaml` and `kubernetes/secrets.example.yaml` define the
*same* Secret name (`musicrank-secrets`). Read `kubernetes/README.md`'s
"Don't run a single recursive `kubectl apply`" warning, then reproduce it
safely:

```bash
kubectl apply -f kubernetes/secrets.example.yaml -f kubernetes/secrets.yaml
kubectl get secret musicrank-secrets -n musicrank -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d
# then put it back:
kubectl apply -f kubernetes/secrets.yaml
```

Whichever file `kubectl` applies *last* wins, silently — no warning, no
error. This is a real bug that existed in this repo until it got caught
(see the Appendix). Order-dependent behavior with no error message is one
of the more dangerous classes of infrastructure bug, because nothing
tells you it happened.

### Check your understanding

- Change a value in `kubernetes/configmap.yaml`, `kubectl apply` it, then
  `kubectl exec` into a running ranking-api Pod and check the env var. Did
  it change? (Hint: ConfigMap changes don't auto-propagate into already-
  running Pods' environment variables — why not? What would have to happen
  for the new value to take effect?)
- Why does `kubernetes/secrets.yaml` appear in `.gitignore` but
  `kubernetes/secrets.example.yaml` doesn't?

---

## Module 5 — Probes & self-healing

### Concepts

Kubernetes can only route traffic around a broken Pod, or restart one,
if it has a way to know the Pod is broken. That's what probes are for —
and they answer two genuinely different questions:

- **readinessProbe** — "should this Pod receive traffic *right now*?" A
  Pod that fails readiness is removed from its Service's endpoints (back
  to Module 3) but is **not** restarted. Use this for "temporarily can't
  serve requests" (e.g. a dependency is briefly unreachable).
- **livenessProbe** — "is this process healthy, or should it be killed and
  restarted?" Use this for "this process is genuinely stuck/crashed," not
  for "a dependency is down" — restarting a process doesn't fix a database
  outage, it just adds pointless churn on top of it.

This project draws that line explicitly by having two different HTTP
endpoints, not one:

### Look at the file

`vote-api/src/app.ts` (not the YAML — the actual TypeScript): `/health`
always returns 200 if the process is up, full stop. `/ready` actually
calls `getRedisClient().ping()` and returns 503 if that fails. Then
`kubernetes/vote-api/deployment.yaml`: `livenessProbe` points at `/health`,
`readinessProbe` points at `/ready`. Same split in `ranking-api/src/app.ts`
(`/ready` checks Postgres instead).

`kubernetes/worker/deployment.yaml` has no `readinessProbe` at all, with a
comment explaining why: nothing routes traffic to worker Pods (no Service
selects them — they pull work from Redis instead of receiving HTTP
requests), so there's nothing for readiness to gate.

### Lab

```bash
kubectl get pods -n musicrank -l app=ranking-api -o wide
kubectl describe pod -n musicrank <a-ranking-api-pod-name> | grep -A3 "Liveness\|Readiness"
```

Now watch a readiness failure happen for real, without breaking anything
permanently — scale Postgres to zero and watch ranking-api's own `/ready`
degrade in response:

```bash
kubectl scale statefulset postgres --replicas=0 -n musicrank
sleep 15
kubectl get pods -n musicrank -l app=ranking-api   # still 1/1? check READY column over the next ~30s
curl -s http://localhost:4002/ready; echo           # expect 503
curl -s http://localhost:4002/health; echo          # still 200 — the process itself is fine
kubectl scale statefulset postgres --replicas=1 -n musicrank
```

Note what did **not** happen: ranking-api's Pods were not restarted. Only
their *readiness* flipped, pulling them out of the Service temporarily.
That's the whole point of the two-probe split — a downstream outage
degrades gracefully instead of causing a restart storm on top of it.

### Break it on purpose (the real bug)

`kubernetes/worker/deployment.yaml`'s `livenessProbe` has a
`timeoutSeconds: 5` with a comment above it. Read the comment, then look
at the default: Kubernetes' built-in default `timeoutSeconds` is **1**.
During this project's actual build, the worker's `/metrics` endpoint
(Module 9) does an async Redis call, and under concurrent scrape load from
both Prometheus and the kubelet's own probe, that occasionally took longer
than 1 second — causing a real restart loop with *nothing informative in
the logs*, just probe timeouts in `kubectl describe pod`.

Reproduce the diagnosis step (not the bug itself — don't actually remove
the fix):

```bash
kubectl describe pod -n musicrank <a-worker-pod-name> | grep -A5 Events
```

Even on a healthy Pod, this is the exact command that revealed the cause
last time — `Liveness probe failed: ... context deadline exceeded` is a
*timeout*, not a crash. Learning to tell those apart from the Events
section is one of the most useful debugging skills this module teaches.

### Check your understanding

- Why does `worker/deployment.yaml` have a `livenessProbe` but no
  `readinessProbe`, while `vote-api/deployment.yaml` has both?
- What's the actual difference in cluster behavior between a Pod that
  fails `readinessProbe` for 10 minutes straight, versus one that fails
  `livenessProbe` once?

---

## Module 6 — StatefulSets & persistent storage

### Concepts

A Deployment's Pods are interchangeable and disposable — any replica can
be deleted and replaced with no loss, because (ideally) none of them hold
state that matters. A database is the opposite: its data is the entire
point, and losing it on every restart isn't survivable.

**StatefulSet** gives Pods two things a Deployment doesn't:
- A **stable identity** (`postgres-0`, not a random suffix — and it keeps
  that exact name across restarts)
- A **PersistentVolumeClaim (PVC)** per Pod, created from a
  `volumeClaimTemplates` entry, that survives Pod deletion/recreation

The PVC is the actual answer to "where does the data live." A Pod is
compute; a PVC is storage; Kubernetes can destroy and recreate the former
while keeping the latter completely untouched.

### Look at the file

`kubernetes/postgres/statefulset.yaml`. Find:
- `volumeClaimTemplates` — this is what makes it a StatefulSet and not
  just "a Deployment with replicas: 1"
- The `subPath: pgdata` comment on the volume mount — a real gotcha:
  Postgres refuses to initialize a data directory that isn't completely
  empty, and mounting a fresh PVC straight at `/var/lib/postgresql/data`
  puts the volume's own `lost+found` directory there, breaking first boot.
  `subPath` works around it by mounting a subdirectory of the volume
  instead of its root.
- `kubernetes/postgres/configmap-init.yaml`'s header comment — it's a
  **generated file** (from `database/migrations/0001_init.sql` and
  `database/seed/seed.sql`), not hand-written. Mounted at
  `/docker-entrypoint-initdb.d`, which Postgres's official image runs
  automatically — but **only** the first time it starts against an empty
  data directory. Already-initialized data is never touched again by
  those scripts.

### Lab

```bash
kubectl exec -n musicrank postgres-0 -- psql -U musicrank -d musicrank \
  -c "INSERT INTO genres (name) VALUES ('Lo-fi') ON CONFLICT DO NOTHING;"
kubectl exec -n musicrank postgres-0 -- psql -U musicrank -d musicrank \
  -c "SELECT * FROM genres WHERE name = 'Lo-fi';"
```

Now prove it survives the Pod being destroyed — not just restarted, fully
deleted:

```bash
kubectl delete pod postgres-0 -n musicrank
kubectl wait --for=condition=Ready pod/postgres-0 -n musicrank --timeout=60s
kubectl exec -n musicrank postgres-0 -- psql -U musicrank -d musicrank \
  -c "SELECT * FROM genres WHERE name = 'Lo-fi';"
```

Same row, same Pod name (`postgres-0` again, not `postgres-1` — that's the
stable identity), different underlying container. This is spec §23's
actual requirement, and it's exactly what `how_to_deploy.md`'s own build
log verified the same way.

```bash
kubectl get pvc -n musicrank
```

The PVC's `AGE` is older than the Pod's — proof it wasn't recreated along
with the Pod.

### Check your understanding

- `kubectl exec -n musicrank postgres-0 -- psql ... -c "DELETE FROM genres WHERE name = 'Lo-fi';"`
  to clean up after yourself. Why does this matter for a shared
  teaching environment, but not for the Postgres `Service`'s `ClusterIP`?
- What would happen to your `Lo-fi` row if you ran
  `kubectl delete statefulset postgres -n musicrank` and reapplied — versus
  `kubectl delete pvc postgres-data-postgres-0 -n musicrank` and reapplied?
  (The second one is destructive — reason about it, don't run it, unless
  you're fine losing the seed data and want to watch the first-boot init
  scripts run again from scratch.)

---

## Module 7 — Scaling & rolling updates

### Concepts

`spec.replicas` is the whole mechanism for horizontal scaling — Kubernetes
doesn't care *why* you want more copies, it just reconciles toward
whatever number you declare. The more interesting question is: **how does
it change from 3 old Pods to 3 new Pods without a gap in service?**

`strategy.rollingUpdate` controls that:
- `maxUnavailable` — how many of the *old* Pods can be down at once during
  the rollout
- `maxSurge` — how many *extra* Pods (beyond the target replica count) can
  exist temporarily while new ones start up before old ones are killed

With `maxUnavailable: 1, maxSurge: 1` on 3 replicas, Kubernetes never
drops below 2 working Pods and never exceeds 4 total — a new Pod comes up
and passes readiness *before* an old one is torn down.

### Look at the file

`kubernetes/vote-api/deployment.yaml`'s `strategy:` block. Also note the
image tag again: `musicrank-vote-api:v0.3.0`. This matters more here than
in Module 2 — read on.

### Lab

Reproduce an actual rolling update and watch it stay available the whole
time — this is the real test this project's own build log used to verify
Phase 6:

```bash
# terminal 1 — hammer the health endpoint continuously
while true; do curl -s -o /dev/null -w "%{http_code} " http://localhost:4001/health; sleep 0.2; done
```

```bash
# terminal 2 — trigger a rolling update (any harmless manifest touch works,
# e.g. bump a resource limit, or just re-apply after changing nothing to
# see Kubernetes correctly recognize there's no diff and do nothing)
kubectl rollout restart deployment/vote-api -n musicrank
kubectl rollout status deployment/vote-api -n musicrank
```

Back in terminal 1: you should see an unbroken stream of `200`s the entire
time, never a gap, never a non-200. That's `maxUnavailable`/`maxSurge`
doing its job.

### Break it on purpose (the real bug)

This one you can't fully "do," but you can reproduce the *diagnosis*.
`how_to_deploy.md`'s troubleshooting section documents it: with
`imagePullPolicy: IfNotPresent` and a tag like `:latest`, rebuilding an
image's *contents* without changing its *tag* gives Kubernetes nothing to
diff against the existing manifest — so `kubectl apply` succeeds, but
silently changes nothing, and `kubectl rollout status` returns instantly
because there's no rollout to do.

```bash
# confirm the actual current tag discipline in this repo:
grep -rn "image: musicrank" kubernetes/*/deployment.yaml
```

Every single one pins a real version, not `:latest` — that's not a style
preference, it's a direct fix for this exact failure mode.

### Check your understanding

- With `replicas: 3` and `maxUnavailable: 1`, what's the minimum number of
  Pods serving traffic at any point during a rollout? What's the maximum
  total Pod count?
- `kubectl rollout history deployment/vote-api -n musicrank` — what does
  this show you, and what command would roll back to the previous version?
  (Try `kubectl rollout undo` against a throwaway change if you want to
  see it work — not against `v0.3.0` itself unless you're prepared to
  redeploy it after.)

---

## Module 8 — RBAC & service accounts

### Concepts

Every Pod can talk to the Kubernetes API — asking "what Pods exist," "what
Services exist," even creating/deleting resources, *if its permissions
allow it*. By default, a Pod's permissions are minimal. Three objects
grant more:

- **ServiceAccount** — an identity a Pod authenticates as (distinct from
  *your* identity when you run `kubectl`)
- **ClusterRole** — a set of permissions (which API resources, which verbs
  — `get`/`list`/`watch`/`create`/etc)
- **ClusterRoleBinding** — grants a ClusterRole to a ServiceAccount

This project needs this for exactly one reason: Prometheus has to ask the
Kubernetes API "what Pods exist right now, and which of them are
annotated for scraping?" — it cannot discover that any other way.

### Look at the file

`monitoring/prometheus/rbac.yaml`, end to end — it's short. Note the
`ClusterRole`'s `rules`: `get`/`list`/`watch` on `pods`/`services`/
`endpoints`/`nodes`, nothing else. No `create`, no `delete`, no `update`.
Prometheus can *observe* the cluster and nothing more — that's the
principle of least privilege, applied concretely rather than as an
abstract rule.

Compare `monitoring/prometheus/kube-state-metrics.yaml`'s `ClusterRole` —
broader (it also watches `deployments`/`replicasets`/`statefulsets`,
since that's literally its job — see Module 9), but still exclusively
read-only verbs.

### Lab

```bash
kubectl get serviceaccount prometheus -n musicrank
kubectl get clusterrole prometheus -o yaml
kubectl get clusterrolebinding prometheus -o yaml
```

Confirm the restriction is real, not just documentation — try to use
Prometheus's own identity to do something its ClusterRole doesn't permit:

```bash
kubectl auth can-i list pods --as=system:serviceaccount:musicrank:prometheus -n musicrank
kubectl auth can-i delete pods --as=system:serviceaccount:musicrank:prometheus -n musicrank
kubectl auth can-i create deployments --as=system:serviceaccount:musicrank:prometheus -n musicrank
```

First one: `yes`. Other two: `no`. That's RBAC actually being enforced,
not just declared.

### Check your understanding

- Why are `ClusterRole` and `ClusterRoleBinding` **not** namespaced
  objects, while `ServiceAccount` is? (`kubectl get clusterrole prometheus`
  works with no `-n` flag — try adding one and see what happens.
  `how_to_deploy.md`'s teardown section has a real consequence of this —
  find it.)
- If you wanted Prometheus to be able to scrape pods in *every* namespace
  in the cluster, not just `musicrank`, what would you need to change in
  `monitoring/prometheus/configmap.yaml`'s `kubernetes_sd_configs`?

---

## Module 9 — Observability

### Concepts

Once a system has multiple replicas across a cluster, "SSH in and check
the logs" stops being a viable debugging strategy — which specific Pod
would you even check? Observability means the system can answer questions
about its own behavior *without* an engineer chasing individual
containers.

This project uses the most common open-source stack for that:
- **Prometheus** — polls ("scrapes") every instrumented service on an
  interval, storing time-series data (`http_requests_total`,
  `votes_processed_total`, etc)
- **Grafana** — queries Prometheus and renders the results as dashboards

The key design choice worth understanding: Prometheus *pulls* metrics from
services (services don't push), and it finds *what* to scrape via
**Kubernetes service discovery** — not a hand-maintained list.

### Look at the file

`vote-api/src/metrics.ts` — real application code, not YAML. Find
`votesReceivedTotal` (a `Counter`) and `httpRequestDurationSeconds` (a
`Histogram`), and `metricsMiddleware`, which updates them on every
request. Then `app.ts`'s `GET /metrics` route — it just serializes
whatever's been counted, in a specific text format Prometheus understands.

Now `kubernetes/vote-api/deployment.yaml`'s pod template `annotations:`:

```yaml
prometheus.io/scrape: "true"
prometheus.io/port: "4001"
prometheus.io/path: "/metrics"
```

And `monitoring/prometheus/configmap.yaml`'s `relabel_configs` — this is
the actual logic that reads those three annotations off every Pod in the
namespace and decides whether/how to scrape it. No service names,
no IPs, no manually-maintained target list: add a 4th replica of vote-api
and Prometheus finds it automatically on the next discovery cycle.

### Lab

```bash
curl -s http://localhost:4001/metrics | grep votes_received_total
```

Generate some real traffic, then watch the counter move:

```bash
curl -s -X POST http://localhost:4001/api/v1/votes \
  -H "Content-Type: application/json" \
  -d '{"songId": 1, "rating": 5, "userId": "'$(python3 -c 'import uuid;print(uuid.uuid4())')'"}'
curl -s http://localhost:4001/metrics | grep 'votes_received_total{result="accepted"}'
```

Confirm Prometheus actually discovered this Pod (not just that the
endpoint itself works):

```bash
curl -s http://localhost:9090/api/v1/targets | python3 -c "
import json, sys
for t in json.load(sys.stdin)['data']['activeTargets']:
    if t['labels'].get('app') == 'vote-api':
        print(t['scrapeUrl'], t['health'])
"
```

Then open Grafana (http://localhost:3000, dashboard **MusicRank**) and
find the same vote reflected in the "Votes received (vote-api)" panel —
same data, three different views: raw text, Prometheus's own query API,
and a rendered graph.

### Break it on purpose

```bash
kubectl scale deployment vote-api --replicas=0 -n musicrank
sleep 20
curl -s http://localhost:9090/api/v1/targets | python3 -c "
import json, sys
targets = [t for t in json.load(sys.stdin)['data']['activeTargets'] if t['labels'].get('app') == 'vote-api']
print(len(targets), 'vote-api targets found')
"
kubectl scale deployment vote-api --replicas=3 -n musicrank
```

Zero targets — not 3 unhealthy ones, *zero*, because there are no Pods
with the annotation to discover anymore. This is the service-discovery
model made visible: Prometheus isn't tracking "vote-api" as a concept, it
only ever knew about specific Pods that existed at discovery time.

### Check your understanding

- `monitoring/prometheus/kube-state-metrics.yaml` exists so the dashboard
  can show "Pod restarts." Why can't `vote-api/src/metrics.ts` report that
  number itself, the way it reports `votes_received_total`?
- What would you need to add to a brand new service for it to show up in
  Prometheus automatically, assuming it already exposes `/metrics`
  correctly? (Check your answer against the annotations block in any
  existing `deployment.yaml`.)

---

## Module 10 — Capstone: deploy it yourself, cold

### The challenge

Everything above was against a cluster that already had state in it. This
time, start from as close to nothing as you're willing to go, and deploy
the entire system using only `kubernetes/how_to_deploy.md` — no peeking at
your shell history, no copy-pasting from earlier in this course.

```bash
kubectl delete namespace musicrank
kubectl delete clusterrole prometheus kube-state-metrics
kubectl delete clusterrolebinding prometheus kube-state-metrics
```

(This is real teardown — it deletes the PVC and all data. Confirm you're
pointed at your own practice cluster, not anything that matters, before
running it. `kubectl config current-context` first.)

Then, using only `how_to_deploy.md` as your reference, get to:

- [ ] All 17 Pods `1/1 Running`, `0` restarts
- [ ] `curl http://localhost:5173/` → 200
- [ ] `curl http://localhost:4002/api/v1/rankings/global?limit=3` → real
      seeded songs, not an empty array
- [ ] A vote submitted via `curl -X POST .../api/v1/votes` shows up in
      `curl http://localhost:4002/api/v1/songs/<id>` within a couple of
      seconds
- [ ] The Grafana dashboard renders real data for that vote
- [ ] `kubectl delete pod postgres-0 -n musicrank`, and the vote you just
      submitted is still there afterward

### If you get stuck

`how_to_deploy.md`'s own Troubleshooting section is built entirely from
real failures hit while this project was being built — check there before
assuming you've found a new bug. If a Stage's rollout hangs, `kubectl
describe pod <name> -n musicrank` and read the `Events:` section before
doing anything else; Module 5 taught you how to read what it's telling
you.

### Once it's green

You've now independently reproduced, from a deploy guide alone, a system
with horizontal scaling, self-healing, persistent storage, zero-downtime
updates, least-privilege service accounts, and full observability. That's
not a toy cluster — it's the actual shape of how real services run in
production. The scale is different; the concepts aren't.

---

## Appendix — real bugs, and what each one teaches

Every one of these actually happened while this project was built (see
the git log and each phase's commit message for the full story). They're
collected here because real infrastructure bugs are better teachers than
clean examples — each shows a *class* of failure worth recognizing
elsewhere, not just the specific fix.

| Bug | Where | What it teaches |
|---|---|---|
| `pg.Pool` crashed the whole process on a dropped idle connection, taking down every replica simultaneously | `ranking-api/src/db.ts`, `worker/src/db.ts` | Node's default behavior for an unhandled `EventEmitter` `'error'` event is to throw. Any long-lived client/pool object needs an explicit `.on("error", ...)` handler, or a transient network blip becomes a full outage. |
| Worker's liveness probe timed out under concurrent scrape load, causing a restart loop with no error in the logs | `kubernetes/worker/deployment.yaml`'s `timeoutSeconds` | A *timeout* and a *crash* look identical from `kubectl get pods` (both show restarts) but have completely different causes — `kubectl describe pod`'s `Events:` section is what actually tells them apart. Always check it before guessing. |
| `secrets.yaml`/`secrets.example.yaml` define the same Secret name — a naive recursive apply lets whichever sorts last silently overwrite the other | `kubernetes/README.md`, `how_to_deploy.md` | Order-dependent behavior with no error message is one of the most dangerous bug classes in infrastructure-as-code — nothing tells you it happened. The fix wasn't a smarter script, it was documenting the exact safe command and never running the unsafe one. |
| Rebuilding an image without changing its tag produced no rollout at all, even though the image on disk had changed | `how_to_deploy.md` Stage 1 | `imagePullPolicy: IfNotPresent` + `:latest` is a known anti-pattern for exactly this reason. Kubernetes reconciles against the *manifest*, not the image's actual bytes — if the manifest doesn't change, nothing happens, regardless of what you rebuilt. |
| `nginx`'s Docker healthcheck failed with "connection refused" even though the app was serving correctly | `frontend/nginx.conf`, `frontend/Dockerfile` (Docker phase, not Kubernetes — see root README) | `localhost` resolved to IPv6 (`::1`) inside the container, but the custom nginx config only bound IPv4. A host that's "clearly up" (confirmed via `curl` from outside) can still fail a healthcheck for an unrelated addressing reason — don't assume the obvious cause first. |

If you find a new one while doing the capstone, that's not a failure of
the course — add it to this table.
