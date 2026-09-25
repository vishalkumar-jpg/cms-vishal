# modules/ecr/outputs.tf

output "repository_urls" {
  description = "Map of service name -> ECR repository URL (push/pull endpoint)."
  value       = { for k, r in aws_ecr_repository.this : k => r.repository_url }
}

output "repository_arns" {
  description = "Map of service name -> ECR repository ARN (for IAM scoping)."
  value       = { for k, r in aws_ecr_repository.this : k => r.arn }
}
