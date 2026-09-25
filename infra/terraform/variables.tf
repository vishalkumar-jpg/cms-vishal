# variables.tf
# -----------------------------------------------------------------------------
# Root-level input variables for the OB-CMS platform skeleton.
# Defaults are "sensible placeholders" — review before any real apply.
# Secrets are intentionally declared WITHOUT defaults so Terraform forces you to
# supply them (and you should supply them via Secrets Manager, not tfvars).
# -----------------------------------------------------------------------------

# ----- Core / global -----

variable "region" {
  description = "AWS region for all regional resources. NOTE: CloudFront ACM certs must be in us-east-1; this skeleton assumes region == us-east-1."
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment. Drives naming and tags."
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment must be one of: dev, staging, prod."
  }
}

variable "project_name" {
  description = "Project slug used as a prefix for all resource names."
  type        = string
  default     = "ob-cms"
}

# ----- Networking -----

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
  default     = "10.20.0.0/16"
}

variable "az_count" {
  description = "Number of Availability Zones to spread subnets across (2 = HA minimum)."
  type        = number
  default     = 2
}

# ----- Database (RDS Postgres) -----

variable "db_instance_class" {
  description = "RDS instance class for the Postgres database."
  type        = string
  default     = "db.t3.medium"
}

variable "db_name" {
  description = "Initial Postgres database name."
  type        = string
  default     = "obcms"
}

variable "db_username" {
  description = "Master username for the Postgres database."
  type        = string
  default     = "obcms_admin"
}

variable "db_password" {
  description = "Master password for the Postgres database. SECRET — no default. In production source this from Secrets Manager and pass via TF_VAR_db_password or -var, never commit it."
  type        = string
  sensitive   = true
  # NO DEFAULT ON PURPOSE — Terraform will error if not supplied.
}

variable "db_multi_az" {
  description = "Whether RDS runs Multi-AZ (recommended true for prod)."
  type        = bool
  default     = false
}

# ----- Cache (ElastiCache Redis) -----

variable "redis_node_type" {
  description = "ElastiCache node type for Redis (used by BullMQ + caching)."
  type        = string
  default     = "cache.t3.micro"
}

# ----- Container images (ECR) -----
# These default to placeholder ECR paths. The actual immutable image tag is
# STUBBED — CI/CD should push real digests and update these (or use SSM).

variable "api_image" {
  description = "Container image for the NestJS API service (port 3001)."
  type        = string
  default     = "ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/ob-cms-dev-api:STUB"
}

variable "worker_image" {
  description = "Container image for the BullMQ worker (no public port)."
  type        = string
  default     = "ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/ob-cms-dev-worker:STUB"
}

variable "renderer_image" {
  description = "Container image for the Next.js renderer service (port 3000)."
  type        = string
  default     = "ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/ob-cms-dev-renderer:STUB"
}

# ----- Service scaling -----

variable "desired_count" {
  description = "Desired ECS task count per service (api/worker/renderer)."
  type = object({
    api      = number
    worker   = number
    renderer = number
  })
  default = {
    api      = 2
    worker   = 1
    renderer = 2
  }
}

# ----- Domains -----

variable "root_domain" {
  description = "Apex domain for the platform, e.g. obcms.example.com. ACM issues a cert for this + *.<root_domain> to cover per-tenant subdomains."
  type        = string
  default     = "obcms.example.com"
}

variable "domain" {
  description = "Primary application domain (often equal to root_domain or app.<root_domain>) used as the default CloudFront alias."
  type        = string
  default     = "app.obcms.example.com"
}

# ----- Tagging -----

variable "tags" {
  description = "Extra tags merged onto resources (in addition to provider default_tags)."
  type        = map(string)
  default     = {}
}
