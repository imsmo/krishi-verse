# Deploy runbook — build images + ship services to EKS

Follows `infra/terraform/APPLY-RUNBOOK-prod.md` (the cluster + data stores must already exist). This wave added:
the **Dockerfiles** (`infra/docker/`), the **Helm charts** (`infra/helm/`), and the **IRSA** roles
(`infra/terraform/modules/irsa`, wired into `envs/prod`). Here's how to go from code → running pods.

> Prereqs on your Mac: `docker`, `aws` CLI v2, `kubectl`, `helm` (v3.12+), and `kubectl` already pointed at the
> cluster (`aws eks update-kubeconfig --name <cluster> --region ap-south-1`).

---

## 1. Apply the IRSA roles (Terraform)

These were added to `envs/prod`. Re-apply to create the per-app IAM roles:
```bash
cd infra/terraform/envs/prod
terraform plan -out tf.plan && terraform apply tf.plan
terraform output -json irsa_role_arns    # map: service-account -> role ARN (used in step 4)
```

---

## 2. Build + push all images to ECR

```bash
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
ACCOUNT=$ACCOUNT REGION=ap-south-1 TAG=$(git rev-parse --short HEAD) \
  ./infra/docker/build-and-push.sh
```
This creates the ECR repos (scan-on-push) and pushes: `krishiverse-node-base:20`, `krishiverse-api`,
`krishiverse-admin-api`, `krishiverse-wallet-service`, `krishiverse-worker`, `krishiverse-realtime-gateway`,
`krishiverse-web-storefront`, `krishiverse-web-tenant`, `krishiverse-web-admin`, `krishiverse-web-partner`,
`krishiverse-ai-services` — all tagged with the short git SHA (`$TAG`).

> **Web apps bake `NEXT_PUBLIC_*` at build time.** Before building web images, set the public API URL as a build
> arg in `build-and-push.sh` (or build web images separately) so the browser bundle points at your prod API
> gateway domain. Server-only env is injected at runtime (step 3).

---

## 3. Create the namespace + the env Secrets (synced from AWS Secrets Manager)

```bash
kubectl create namespace krishiverse
```

Each backend chart reads its env from a Kubernetes Secret (`envFromSecretNames`). The **recommended** way to keep
these in sync with AWS Secrets Manager is the **External Secrets Operator** (ESO):
```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets -n external-secrets --create-namespace
```
Then create an `ExternalSecret` per service that pulls from `krishiverse-prod/*` into the k8s Secret names the
charts expect: `krishiverse-api-env`, `krishiverse-admin-api-env`, `krishiverse-wallet-env`,
`krishiverse-worker-env`, `krishiverse-realtime-env`, `krishiverse-ai-env`.

> **Quick manual alternative (to test before wiring ESO)** — create one secret by hand. Build the connection
> strings from the Terraform outputs (`aurora_writer_endpoint`, `redis_primary_endpoint`, …) and the generated
> secrets in Secrets Manager. Example for the API:
> ```bash
> kubectl -n krishiverse create secret generic krishiverse-api-env \
>   --from-literal=DATABASE_URL='postgres://kv_app:***@<aurora_writer>:5432/krishiverse' \
>   --from-literal=READ_REPLICA_URL='postgres://kv_app:***@<aurora_reader>:5432/krishiverse' \
>   --from-literal=REDIS_URL='rediss://:***@<redis_primary>:6379' \
>   --from-literal=JWT_ACCESS_SECRET="$(aws secretsmanager get-secret-value --secret-id krishiverse-prod/jwt/access_secret --query SecretString --output text)" \
>   --from-literal=WALLET_GRPC_URL='krishiverse-wallet-service.krishiverse.svc.cluster.local:50051' \
>   --from-literal=OPENSEARCH_URL='https://<opensearch_endpoint>' \
>   --from-literal=S3_BUCKET='<media_bucket_name>'
> ```
> (The DB roles `kv_app`/`kv_wallet`/`kv_relay` are created in **P0-5** from the Aurora master secret — with strong
> passwords from Secrets Manager, never the dev SQL.)

---

## 4. Install the charts (one Helm release per service)

First vendor the library chart into each service chart:
```bash
cd infra/helm
for c in api admin-api wallet-service worker realtime-gateway ai-services web web-partner; do
  helm dependency build ./$c
done
```

Set the ECR + IRSA placeholders and install. Example for the API (repeat per service, using its image repo + the
matching role ARN from step 1):
```bash
ECR=$ACCOUNT.dkr.ecr.ap-south-1.amazonaws.com
API_ROLE=$(terraform -chdir=../terraform/envs/prod output -json irsa_role_arns | jq -r '.api')

helm upgrade --install api ./api -n krishiverse \
  --set image.repository=$ECR/krishiverse-api \
  --set image.tag=$TAG \
  --set serviceAccount.roleArn=$API_ROLE
```

Service-by-service notes:
- **wallet-service** → role `wallet-service`, gRPC service on 50051.
- **worker** → role `worker`, no Service (background only).
- **realtime-gateway** → role `realtime-gateway`, sticky ClientIP service on 8090.
- **ai-services** → role `ai-services`.
- **web apps** → the generic `web` chart, one release each (no IRSA needed):
  ```bash
  helm upgrade --install web-storefront ./web -n krishiverse --set image.repository=$ECR/krishiverse-web-storefront --set image.tag=$TAG
  helm upgrade --install web-tenant     ./web -n krishiverse --set image.repository=$ECR/krishiverse-web-tenant     --set image.tag=$TAG
  helm upgrade --install web-admin      ./web -n krishiverse --set image.repository=$ECR/krishiverse-web-admin      --set image.tag=$TAG
  helm upgrade --install web-partner    ./web-partner -n krishiverse --set image.repository=$ECR/krishiverse-web-partner --set image.tag=$TAG
  ```

---

## 5. Verify

```bash
kubectl -n krishiverse get pods,svc,hpa
kubectl -n krishiverse rollout status deploy/api
kubectl -n krishiverse logs deploy/api --tail=50
# in-cluster smoke (no public ingress yet — that's the edge wave):
kubectl -n krishiverse run curl --rm -it --image=curlimages/curl --restart=Never -- \
  curl -s http://api.krishiverse.svc.cluster.local/healthz
```
All pods `Running`/`Ready`, HPAs showing targets, `/healthz` returns ok = the services are live in the cluster.

---

## 6. Validate the charts before installing (recommended)

```bash
cd infra/helm
for c in api admin-api wallet-service worker realtime-gateway ai-services web web-partner; do
  helm lint ./$c
  helm template test ./$c >/dev/null && echo "$c renders OK"
done
```
(These run `helm` locally — they were NOT runnable in the authoring sandbox, so run them here first.)

---

## What's still needed to serve PUBLIC traffic (edge wave — separate task)
The services run **inside** the cluster now, but there is no public entrypoint yet. The **edge wave** adds:
AWS Load Balancer Controller + an `Ingress` per web/api, an **ACM TLS cert** for your domain, the **WAF**, and
**Route 53** DNS records. That wave needs your **production domain name**. Until then, reach services via
`kubectl port-forward` for testing.
