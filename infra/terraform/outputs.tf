# outputs.tf
# -----------------------------------------------------------------------------
# Root outputs — useful for CI/CD, DNS wiring, and debugging.
# -----------------------------------------------------------------------------

output "alb_dns_name" {
  description = "Public DNS name of the Application Load Balancer (CloudFront origin)."
  value       = module.compute.alb_dns_name
}

output "cloudfront_domain" {
  description = "CloudFront distribution domain name. Point your DNS (CNAME/ALIAS) here."
  value       = module.cdn.cloudfront_domain
}

output "rds_endpoint" {
  description = "RDS Postgres connection endpoint (host:port)."
  value       = module.data.rds_endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache Redis primary endpoint (host:port)."
  value       = module.data.redis_endpoint
}

output "media_bucket" {
  description = "S3 media bucket name (served via CloudFront, not public)."
  value       = module.storage.bucket_id
}

output "ecr_repository_urls" {
  description = "Map of service name -> ECR repository URL."
  value       = module.ecr.repository_urls
}
