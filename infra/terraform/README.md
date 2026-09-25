# OB-CMS Platform — Terraform Infrastructure (SKELETON)

> ⚠️ **NOT YET PROVISIONED.** This is a *plan / skeleton only*. Nothing here has
> been `terraform apply`-ed. Many values are intentionally **STUBBED** (image
> tags, ACM DNS validation, secret values, per-tenant domains, remote state).
> **Do not run `terraform apply` without a full review and the changes noted
> below.**

This directory describes the target AWS architecture for the OB-CMS
multi-tenant CMS platform as Infrastructure-as-Code (Terraform 0.13+, AWS
provider `~> 5.0`). It is written to `terraform validate` cleanly *in principle*
(coherent references, real attribute names) but is **not** wired to real
credentials or a real backend.

---

## What gets deployed (target state)

Four deployable services from the OB-CMS monorepo:

| Service   | Tech                     | Port | Public? | Notes                          |
|-----------|--------------------------|------|---------|--------------------------------|
| `api`     | NestJS                   | 3001 | via ALB | Routed at `/api/*`             |
| `worker`  | BullMQ background worker | —    | no      | No LB, no public port          |
| `renderer`| Next.js                  | 3000 | via ALB | Default route                  |
| `admin`   | static Vite SPA          | —    | via CDN | Served as static assets (S3/CF)|

Backing infrastructure: **VPC** (public/private subnets, NAT), **RDS Postgres**,
**ElastiCache Redis**, **S3** media bucket, **ECR** repos, **ECS Fargate**
cluster + ALB, **CloudFront** CDN, **ACM** TLS, and a **WAFv2** web ACL.

> NOTE: `admin` is a static SPA. This skeleton provisions the compute for
> api/worker/renderer; the admin SPA can be served from the S3 + CloudFront
> stack (an additional cache behavior / origin) — left as a follow-up.

---

## Apply order / dependency graph

Terraform resolves ordering from references, but conceptually:

```
            ┌─────────────┐
            │   network   │  VPC, subnets, NAT, route tables
            └──────┬──────┘
        ┌──────────┼───────────┬───────────┐
        ▼          ▼           ▼           ▼
   ┌────────┐ ┌────────┐  ┌──────────┐ ┌──────┐
   │ ecr    │ │security│  │ storage  │ │ data │  (parallel-ish)
   └───┬────┘ └───┬────┘  └────┬─────┘ └──┬───┘
       └──────────┴────────────┼──────────┘
                               ▼
                         ┌───────────┐
                         │  compute  │  ALB + ECS services
                         └─────┬─────┘
                               ▼
                         ┌───────────┐
                         │    cdn    │  ACM + CloudFront + WAF
                         └───────────┘
```

### Module graph is acyclic (cycles already broken)

Three conceptual cycles exist in this topology; all three are broken in the
skeleton so the module graph is a DAG and `terraform validate` passes:

| Conceptual cycle | How it is broken |
|---|---|
| `storage` ↔ `cdn` (bucket policy needs the distribution ARN; the distribution needs the bucket domain) | The OAC `aws_s3_bucket_policy` lives in the **cdn** module, which owns the distribution and receives the bucket id/arn as inputs. `storage` never refers back to `cdn`. |
| `compute` ↔ `cdn` (ALB cert vs. ALB origin) | `compute` issues its **own regional** `aws_acm_certificate` for the ALB listener instead of reusing the cdn (us-east-1) cert. CloudFront and the ALB legitimately need certs in different regions anyway. |
| `data` ↔ `compute` (DB ingress SG vs. DB endpoint) | One-directional: `data` allows ingress only from `compute`'s ECS SG. `compute` does **not** read `data`'s endpoints — the app gets `DATABASE_URL`/`REDIS_URL` from **Secrets Manager** (more secure, and breaks the back-edge). |

See the `DECOUPLING NOTE` comments in `modules/{storage,compute,cdn}/main.tf`.

For very large production estates you may still prefer **layered stacks**
(`network`+`data` in one state, `compute` in another, `cdn`+`storage` in a
third, wired by `terraform_remote_state`) for blast-radius isolation — but it is
not required to validate or apply this skeleton.

---

## What is intentionally STUBBED

| Area | Stub | Real action required |
|------|------|----------------------|
| **Container images** | `*_image` vars default to `ACCOUNT_ID...:STUB` | CI/CD pushes real images to ECR, updates tags (or use SSM/image digests). |
| **ACM DNS validation** | Validation records are created but the `aws_acm_certificate_validation` wait + Route53 record creation are commented | Add the Route53 (or external DNS) `CNAME` validation records; uncomment the validation resource. |
| **Secrets Manager values** | Secrets created with placeholder `"STUB-set-out-of-band"` values | Set real `JWT_SECRET`, `DATABASE_URL`, `ENCRYPTION_KEY`, `CRM_HMAC_SECRET` via `aws secretsmanager put-secret-value` (NOT in Terraform). |
| **DB password** | `db_password` has no default | Supply via `TF_VAR_db_password`; ideally store/rotate in Secrets Manager. |
| **Per-tenant domains** | Single wildcard `*.root_domain` SAN cert | See "Per-tenant custom domains" below. |
| **Remote state backend** | S3+DynamoDB backend commented out in `versions.tf` | Pre-create bucket + lock table; uncomment; `terraform init -migrate-state`. |
| **ALB cert** | Reuses CDN ACM cert ARN | Issue a separate *regional* ACM cert for the ALB if you keep public TLS on it. |

---

## Per-tenant custom domains → ACM + CloudFront

Tenants get subdomains like `acme.obcms.example.com`. We handle these with a
**single wildcard certificate**:

- ACM issues a cert for `root_domain` **and** `*.root_domain` (SAN). One
  CloudFront distribution with `aliases = [root_domain, "*.root_domain"]` then
  serves **all** tenant subdomains via **SNI** — no per-tenant cert needed.
- The renderer reads the incoming `Host` header to resolve the tenant.

For tenants bringing a **fully custom apex domain** (e.g. `www.acme.com`, not a
subdomain of `root_domain`), the wildcard does **not** cover them. Future
automation (left as a follow-up):

1. Per-tenant `aws_acm_certificate` (DNS-validated) for the custom domain.
2. Add the domain to the CloudFront distribution `aliases` (or use a
   per-tenant distribution / CloudFront SaaS / `cloudfront-multi-tenant`).
3. Automate DNS validation record creation when the tenant delegates DNS.

This is **not** implemented here — only the wildcard SAN approach is wired.

---

## Prerequisites

- Terraform >= 0.13 (tested syntax targets 1.x).
- An AWS account + credentials with permissions for VPC/RDS/ElastiCache/ECS/
  ECR/S3/CloudFront/ACM/WAF/IAM/SecretsManager/SSM.
- A registered domain + a Route53 hosted zone (for ACM DNS validation and CDN
  aliasing) — **not** created by this skeleton.
- (For real state) a pre-created S3 state bucket + DynamoDB lock table.

## Usage (skeleton)

```bash
cd infra/terraform
terraform init        # uses LOCAL backend (remote backend is commented out)
terraform validate    # passes: module graph is acyclic, attributes are valid
# terraform plan      # DO NOT run against a real account without review
```

> ⚠️ **Final warning:** review every STUB above, set real secrets out-of-band,
> complete ACM DNS validation, and confirm the cost footprint (NAT GW, RDS,
> ElastiCache, ALB, CloudFront all bill continuously) **before** any apply.
