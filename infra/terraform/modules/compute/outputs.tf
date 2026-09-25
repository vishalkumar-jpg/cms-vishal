# modules/compute/outputs.tf

output "alb_dns_name" {
  description = "Public DNS name of the ALB (use as CloudFront custom origin)."
  value       = aws_lb.this.dns_name
}

output "alb_zone_id" {
  description = "Route53 hosted zone ID of the ALB (for ALIAS records)."
  value       = aws_lb.this.zone_id
}

output "ecs_service_sg_id" {
  description = "Security group ID of the ECS services (used by data module ingress rules)."
  value       = aws_security_group.ecs_service.id
}

output "cluster_name" {
  description = "ECS cluster name."
  value       = aws_ecs_cluster.this.name
}

output "service_names" {
  description = "Map of logical service -> ECS service name."
  value = {
    api      = aws_ecs_service.api.name
    worker   = aws_ecs_service.worker.name
    renderer = aws_ecs_service.renderer.name
  }
}
