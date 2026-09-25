# main.tf
# -----------------------------------------------------------------------------
# Root composition: wires all modules together and threads outputs between them.
#
# Dependency / apply order (Terraform resolves this automatically from refs):
#   network  -> (storage, ecr, security) can run in parallel
#   compute  -> needs network + ecr + security  (issues its own ALB ACM cert)
#   data     -> needs network + compute (compute's ECS SG is its only ingress)
#   cdn      -> needs compute (ALB origin) + storage (S3 origin); also OWNS the
#               S3 OAC bucket policy so storage never refers back to cdn
#
# The wiring is intentionally ACYCLIC (no module cycles): the three natural
# cycles — storage<->cdn, compute<->cdn, data<->compute — are each broken by
# moving the back-reference to the owning side (see the DECOUPLING NOTE comments
# in modules/{storage,compute,cdn}). This is what lets `terraform validate` pass.
#
# STATUS: SKELETON / NOT YET PROVISIONED.
# -----------------------------------------------------------------------------

locals {
  # Common name prefix used by all modules: e.g. "ob-cms-dev-"
  name_prefix = "${var.project_name}-${var.environment}"

  # Tags merged onto module resources where modules accept a `tags` input.
  # (provider default_tags already adds Project/ManagedBy/Environment globally.)
  common_tags = merge(
    {
      "Name" = local.name_prefix
    },
    var.tags,
  )
}

# ----- 1. Network: VPC, subnets, NAT, route tables ---------------------------
module "network" {
  source = "./modules/network"

  name_prefix = local.name_prefix
  vpc_cidr    = var.vpc_cidr
  az_count    = var.az_count
  tags        = local.common_tags
}

# ----- 2. Storage: S3 media bucket (served via CloudFront OAC) ---------------
module "storage" {
  source = "./modules/storage"

  name_prefix = local.name_prefix
  tags        = local.common_tags
}

# ----- 3. Data: RDS Postgres + ElastiCache Redis -----------------------------
module "data" {
  source = "./modules/data"

  name_prefix        = local.name_prefix
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids

  # Only the ECS service security group may reach the DB / Redis.
  ingress_security_group_ids = [module.compute.ecs_service_sg_id]

  db_instance_class = var.db_instance_class
  db_name           = var.db_name
  db_username       = var.db_username
  db_password       = var.db_password # SECRET (sensitive var)
  db_multi_az       = var.db_multi_az

  redis_node_type = var.redis_node_type

  tags = local.common_tags
}

# ----- 4. Security: Secrets Manager, SSM params, IAM roles -------------------
module "security" {
  source = "./modules/security"

  name_prefix = local.name_prefix
  region      = var.region

  # ECR repo ARNs let the execution role be scoped to pull only our images.
  ecr_repository_arns = values(module.ecr.repository_arns)

  # Media bucket ARN so the task role can read/write media.
  media_bucket_arn = module.storage.bucket_arn

  tags = local.common_tags
}

# ----- 5. ECR: container repositories ----------------------------------------
module "ecr" {
  source = "./modules/ecr"

  name_prefix  = local.name_prefix
  repositories = ["api", "worker", "renderer"]
  tags         = local.common_tags
}

# ----- 6. Compute: ALB + ECS Fargate cluster & services ----------------------
module "compute" {
  source = "./modules/compute"

  name_prefix        = local.name_prefix
  region             = var.region
  vpc_id             = module.network.vpc_id
  public_subnet_ids  = module.network.public_subnet_ids
  private_subnet_ids = module.network.private_subnet_ids

  # Container images (placeholders / STUB tags).
  api_image      = var.api_image
  worker_image   = var.worker_image
  renderer_image = var.renderer_image

  desired_count = var.desired_count

  # ECR repo URLs (informational; task defs use the *_image vars above).
  ecr_repository_urls = module.ecr.repository_urls

  # IAM roles from the security module.
  execution_role_arn = module.security.ecs_task_execution_role_arn
  task_role_arn      = module.security.ecs_task_role_arn

  # Secret ARNs injected into containers via `secrets.valueFrom` — this is also
  # how the app receives DATABASE_URL / REDIS_URL (kept out of plain env, and
  # avoids a compute<->data module cycle).
  secret_arns = module.security.secret_arns

  # The ALB issues its OWN regional ACM cert (in-module) covering this domain —
  # see the cycle-break note in modules/compute/main.tf.
  root_domain = var.root_domain

  tags = local.common_tags
}

# ----- 7. CDN: ACM + CloudFront + WAF ----------------------------------------
module "cdn" {
  source = "./modules/cdn"

  name_prefix = local.name_prefix
  root_domain = var.root_domain
  domain      = var.domain

  # ALB origin (custom origin over HTTPS).
  alb_dns_name = module.compute.alb_dns_name

  # S3 media origin (regional domain name for OAC) + identifiers so the cdn
  # module attaches the OAC bucket policy (kept here to break a module cycle).
  s3_bucket_regional_domain_name = module.storage.bucket_regional_domain_name
  s3_bucket_id                   = module.storage.bucket_id
  s3_bucket_arn                  = module.storage.bucket_arn

  tags = local.common_tags
}
