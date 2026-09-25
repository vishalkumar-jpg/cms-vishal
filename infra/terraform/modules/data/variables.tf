# modules/data/variables.tf

variable "name_prefix" {
  description = "Prefix for resource names, e.g. ob-cms-dev."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID the DB/Redis security groups live in."
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the DB and cache subnet groups."
  type        = list(string)
}

variable "ingress_security_group_ids" {
  description = "Security group IDs allowed to connect to Postgres (5432) and Redis (6379) — typically the ECS service SG."
  type        = list(string)
  default     = []
}

# ----- Postgres -----
variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
}

variable "db_name" {
  description = "Initial database name."
  type        = string
}

variable "db_username" {
  description = "Master username."
  type        = string
}

variable "db_password" {
  description = "Master password (SECRET). Sourced from Secrets Manager in production — STUB here."
  type        = string
  sensitive   = true
}

variable "db_multi_az" {
  description = "Whether RDS is Multi-AZ."
  type        = bool
  default     = false
}

variable "db_engine_version" {
  description = "Postgres engine version."
  type        = string
  default     = "16.3"
}

variable "db_allocated_storage" {
  description = "Allocated storage (GiB)."
  type        = number
  default     = 50
}

# ----- Redis -----
variable "redis_node_type" {
  description = "ElastiCache node type."
  type        = string
}

variable "redis_engine_version" {
  description = "Redis engine version."
  type        = string
  default     = "7.1"
}

variable "tags" {
  description = "Tags to apply."
  type        = map(string)
  default     = {}
}
