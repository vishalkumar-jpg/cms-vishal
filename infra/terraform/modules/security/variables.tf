# modules/security/variables.tf

variable "name_prefix" {
  description = "Prefix for resource names, e.g. ob-cms-dev."
  type        = string
}

variable "region" {
  description = "AWS region (used to build SSM/secret ARNs where needed)."
  type        = string
}

variable "ecr_repository_arns" {
  description = "ECR repository ARNs the execution role may pull from (scoping)."
  type        = list(string)
  default     = []
}

variable "media_bucket_arn" {
  description = "ARN of the media S3 bucket the task role may read/write."
  type        = string
}

variable "tags" {
  description = "Tags to apply."
  type        = map(string)
  default     = {}
}
