# modules/data/outputs.tf

output "rds_endpoint" {
  description = "RDS Postgres connection endpoint (host:port)."
  value       = aws_db_instance.postgres.endpoint
}

output "rds_address" {
  description = "RDS Postgres hostname only."
  value       = aws_db_instance.postgres.address
}

output "redis_endpoint" {
  description = "Redis primary endpoint host:port."
  value       = "${aws_elasticache_replication_group.redis.primary_endpoint_address}:${aws_elasticache_replication_group.redis.port}"
}

output "postgres_security_group_id" {
  description = "Security group ID protecting Postgres."
  value       = aws_security_group.postgres.id
}

output "redis_security_group_id" {
  description = "Security group ID protecting Redis."
  value       = aws_security_group.redis.id
}
