# modules/cdn/variables.tf

variable "name_prefix" {
  description = "Prefix for resource names, e.g. ob-cms-dev."
  type        = string
}

variable "root_domain" {
  description = "Apex domain. Cert covers root_domain + *.root_domain (tenant subdomains)."
  type        = string
}

variable "domain" {
  description = "Primary default alias for the distribution."
  type        = string
}

variable "alb_dns_name" {
  description = "ALB DNS name used as the CloudFront custom (dynamic) origin."
  type        = string
}

variable "s3_bucket_regional_domain_name" {
  description = "Regional domain name of the media S3 bucket (S3 origin)."
  type        = string
}

variable "s3_bucket_id" {
  description = "Media bucket id/name (used for the OAC bucket policy + origin id)."
  type        = string
}

variable "s3_bucket_arn" {
  description = "Media bucket ARN (scopes the OAC GetObject policy)."
  type        = string
}

variable "waf_rate_limit" {
  description = "Max requests per 5-minute window per IP before the rate rule blocks."
  type        = number
  default     = 2000
}

variable "tags" {
  description = "Tags to apply."
  type        = map(string)
  default     = {}
}
