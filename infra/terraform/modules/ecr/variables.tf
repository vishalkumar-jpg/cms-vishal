# modules/ecr/variables.tf

variable "name_prefix" {
  description = "Prefix for resource names, e.g. ob-cms-dev."
  type        = string
}

variable "repositories" {
  description = "Logical service names to create ECR repos for (e.g. api, worker, renderer)."
  type        = list(string)
  default     = ["api", "worker", "renderer"]
}

variable "keep_last_images" {
  description = "How many of the most recent images to retain (lifecycle policy)."
  type        = number
  default     = 10
}

variable "tags" {
  description = "Tags to apply."
  type        = map(string)
  default     = {}
}
