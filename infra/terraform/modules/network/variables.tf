# modules/network/variables.tf

variable "name_prefix" {
  description = "Prefix for resource names, e.g. ob-cms-dev."
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC."
  type        = string
}

variable "az_count" {
  description = "Number of AZs to spread subnets across."
  type        = number
}

variable "tags" {
  description = "Tags to apply to resources."
  type        = map(string)
  default     = {}
}
