# Building and pushing MusicRank's images to Docker Hub

Every command to build all 4 application images and push them to your own
Docker Hub account. This is a **different** path from `.github/workflows/
build.yml` (Phase 7's CI/CD), which already builds and pushes these same
4 images to GHCR automatically on every push to `main`/`master`/`feature`
— that flow needs no manual steps at all. This doc is for when you want
the images on **Docker Hub specifically**, built **locally, by hand** —
the real use case being a cluster that can't reach GHCR, or that you'd
simply rather pull from Docker Hub (e.g. the kubeadm cluster on Proxmox —
see root `README.md`'s GitOps/Kubernetes sections for why a cluster on
separate VMs can't use the local-image-store shortcut Docker Desktop's
Kubernetes gets).

---

## Prerequisites

- A Docker Hub account and a repository namespace (your username, or an
  organization you have push access to)
- Docker logged in locally:

  ```bash
  docker login
  ```

  (prompts for your Docker Hub username/password or access token — never
  pass credentials as a command-line argument, they'd end up in your shell
  history)

- Set your namespace once, reuse it in every command below:

  ```bash
  export DOCKERHUB_USERNAME=<your-dockerhub-username>
  ```

---

## Why versioned tags, not just `:latest`

Every command below tags with **both** a real version (matching the
service's `package.json`) **and** `:latest`. The version tag is what
Kubernetes manifests should actually reference. This isn't a style
preference — `kubernetes/how_to_deploy.md`'s Troubleshooting section and
`kubernetes/study.md`'s Appendix both document a real bug from relying on
`:latest` with `imagePullPolicy: IfNotPresent`: rebuilding an image
without changing its tag gives Kubernetes nothing to diff against the
existing manifest, so a real code change silently fails to roll out. Pull
from Docker Hub specifically has an even sharper version of this problem —
`imagePullPolicy: Always` (needed for `:latest` to ever re-pull) means
*every* pod restart re-downloads the image from the internet, even when
nothing changed.

---

## Architecture note

This was written and verified on an `x86_64`/`amd64` machine. A plain
`docker build` produces an image for whatever architecture the Docker
daemon itself is running on — confirm yours before assuming the image
will run on your target cluster:

```bash
docker version --format '{{.Server.Arch}}'
```

If you're building on Apple Silicon (`arm64`) for an `amd64` cluster (most
Proxmox VMs), add `--platform linux/amd64` to every `docker build` command
below, or use `docker buildx build --platform linux/amd64 --push ...` to
build and push in one step. Mismatched architecture doesn't fail the
build — it fails at `kubectl run`/pod start on the target cluster instead,
with a much more confusing error (`exec format error`), so check this
first.

---

## Build, tag, and push — one service at a time

### vote-api

```bash
docker build -t musicrank-vote-api:v0.3.0 ./vote-api

docker tag musicrank-vote-api:v0.3.0 $DOCKERHUB_USERNAME/musicrank-vote-api:v0.3.0
docker tag musicrank-vote-api:v0.3.0 $DOCKERHUB_USERNAME/musicrank-vote-api:latest

docker push $DOCKERHUB_USERNAME/musicrank-vote-api:v0.3.0
docker push $DOCKERHUB_USERNAME/musicrank-vote-api:latest
```

### ranking-api

```bash
docker build -t musicrank-ranking-api:0.2.0 ./ranking-api

docker tag musicrank-ranking-api:0.2.0 $DOCKERHUB_USERNAME/musicrank-ranking-api:0.2.0
docker tag musicrank-ranking-api:0.2.0 $DOCKERHUB_USERNAME/musicrank-ranking-api:latest

docker push $DOCKERHUB_USERNAME/musicrank-ranking-api:0.2.0
docker push $DOCKERHUB_USERNAME/musicrank-ranking-api:latest
```

### worker

```bash
docker build -t musicrank-worker:0.2.0 ./worker

docker tag musicrank-worker:0.2.0 $DOCKERHUB_USERNAME/musicrank-worker:0.2.0
docker tag musicrank-worker:0.2.0 $DOCKERHUB_USERNAME/musicrank-worker:latest

docker push $DOCKERHUB_USERNAME/musicrank-worker:0.2.0
docker push $DOCKERHUB_USERNAME/musicrank-worker:latest
```

### frontend — read this one before running it

Unlike the three above, frontend's Dockerfile takes build args that get
**baked into the compiled JavaScript at build time** (Vite inlines
`import.meta.env.VITE_*` — see `frontend/Dockerfile`'s own comment on
this). They default to `http://localhost:4001`/`4002`, which is only
correct when the browser loading the frontend and the APIs it calls are
both reachable at `localhost` — true for Docker Compose and Docker
Desktop Kubernetes, **not** true once this is deployed to a real
multi-node cluster, where `localhost` means "the user's own laptop," not
the cluster.

If this image is headed for Docker Compose or Docker Desktop Kubernetes,
the defaults are correct and you can omit the build args entirely:

```bash
docker build -t musicrank-frontend:0.0.0 ./frontend
```

If it's headed for a real cluster (the Proxmox kubeadm setup, for
example), override them to wherever the APIs will actually be reachable
from — a MetalLB-assigned IP, an Ingress hostname, whatever that cluster's
exposure story ends up being (not yet decided as of this doc — see root
`README.md`'s Kubernetes section):

```bash
docker build \
  --build-arg VITE_VOTE_API_URL=http://<vote-api-reachable-address>:4001 \
  --build-arg VITE_RANKING_API_URL=http://<ranking-api-reachable-address>:4002 \
  -t musicrank-frontend:0.0.0 ./frontend
```

Either way, tag and push the same:

```bash
docker tag musicrank-frontend:0.0.0 $DOCKERHUB_USERNAME/musicrank-frontend:0.0.0
docker tag musicrank-frontend:0.0.0 $DOCKERHUB_USERNAME/musicrank-frontend:latest

docker push $DOCKERHUB_USERNAME/musicrank-frontend:0.0.0
docker push $DOCKERHUB_USERNAME/musicrank-frontend:latest
```

---

## All 4, copy-paste block (Docker Desktop / Compose target — default build args)

```bash
export DOCKERHUB_USERNAME=<your-dockerhub-username>
docker login

for svc_tag in "vote-api:v0.3.0" "ranking-api:0.2.0" "worker:0.2.0" "frontend:0.0.0"; do
  svc="${svc_tag%%:*}"
  tag="${svc_tag##*:}"
  docker build -t "musicrank-$svc:$tag" "./$svc"
  docker tag "musicrank-$svc:$tag" "$DOCKERHUB_USERNAME/musicrank-$svc:$tag"
  docker tag "musicrank-$svc:$tag" "$DOCKERHUB_USERNAME/musicrank-$svc:latest"
  docker push "$DOCKERHUB_USERNAME/musicrank-$svc:$tag"
  docker push "$DOCKERHUB_USERNAME/musicrank-$svc:latest"
done
```

(Skips frontend's build-arg override — re-run frontend separately with
the `--build-arg` flags above if this is headed for a real cluster.)

---

## Verify the push actually worked

```bash
docker pull $DOCKERHUB_USERNAME/musicrank-vote-api:v0.3.0
```

A pull of an image that was never actually pushed fails immediately and
clearly — if this succeeds, the push genuinely reached Docker Hub, not
just your local cache (`docker images` would show the tag either way,
whether or not the push succeeded, so it alone doesn't prove anything).
Or check visually: `https://hub.docker.com/r/<your-username>/musicrank-vote-api/tags`.

---

## What's next (not covered by this doc)

Once pushed, a cluster pulling these needs each
`kubernetes/<service>/deployment.yaml`'s `image:` line changed from the
local-only `musicrank-<service>:<tag>` to
`docker.io/$DOCKERHUB_USERNAME/musicrank-<service>:<tag>`, and
`imagePullPolicy` reconsidered (`IfNotPresent` only skips a re-pull if the
exact tag already exists locally on that node — fine for a tag that never
changes contents, risky for anything reused like `:latest`). That's a
real manifest change, not just a build/push step, so it's deliberately
left for whenever these images actually get deployed to the Proxmox
cluster, rather than guessed at here.
