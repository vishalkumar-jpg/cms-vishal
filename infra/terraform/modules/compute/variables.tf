# modules/compute/variables.tf

variable "name_prefix" {
  description = "Prefix for resource names, e.g. ob-cms-dev."
  type        = string
}

variable "region" {
  description = "AWS region (for CloudWatch log group awslogs config)."
  type        = string
}

variable "vpc_id" {
  description = "VPC ID."
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnet IDs for the ALB."
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the ECS tasks."
  type        = list(string)
}

# ----- Images -----
variable "api_image" {
  description = "Container image for the api service."
  type        = string
}

variable "worker_image" {
  description = "Container image for the worker service."
  type        = string
}

variable "renderer_image" {
  description = "Container image for the renderer service."
  type        = string
}

variable "desired_count" {
  description = "Desired task count per service."
  type = object({
    api      = number
    worker   = number
    renderer = number
  })
}

variable "ecr_repository_urls" {
  description = "Map of service -> ECR repo URL (informational)."
  type        = map(string)
  default     = {}
}

# ----- IAM -----
variable "execution_role_arn" {
  description = "ECS task execution role ARN."
  type        = string
}

variable "task_role_arn" {
  description = "ECS task role ARN."
  type        = string
}

# ----- Secrets / config -----
variable "secret_arns" {
  description = "Map of logical secret name -> Secrets Manager ARN, injected via valueFrom."
  type        = map(string)
}

# ----- TLS -----
variable "root_domain" {
  description = "Apex domain; the ALB's regional ACM cert covers it + *.root_domain."
  type        = string
}

variable "tags" {
  description = "Tags to apply."
  type        = map(string)
  default     = {}
}
