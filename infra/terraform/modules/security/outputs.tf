# modules/security/outputs.tf

output "ecs_task_execution_role_arn" {
  description = "ARN of the ECS task execution role (image pull + secret read)."
  value       = aws_iam_role.ecs_task_execution.arn
}

output "ecs_task_role_arn" {
  description = "ARN of the ECS task role (app runtime perms)."
  value       = aws_iam_role.ecs_task.arn
}

output "secret_arns" {
  description = "Map of logical secret name -> Secrets Manager ARN (for task def valueFrom)."
  value       = { for k, s in aws_secretsmanager_secret.app : k => s.arn }
}
