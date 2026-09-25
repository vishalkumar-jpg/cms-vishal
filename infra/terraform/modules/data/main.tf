# modules/data/main.tf
# -----------------------------------------------------------------------------
# Stateful backing services: RDS Postgres + ElastiCache Redis.
# Both live in PRIVATE subnets and are reachable only from the ECS service SG.
# -----------------------------------------------------------------------------

# =============================================================================
# Security groups
# =============================================================================

# ----- Postgres SG: ingress 5432 from the app SG(s) only ---------------------
resource "aws_security_group" "postgres" {
  name        = "${var.name_prefix}-postgres-sg"
  description = "Allow Postgres access from app tasks only"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, { Name = "${var.name_prefix}-postgres-sg" })
}

resource "aws_security_group_rule" "postgres_ingress" {
  count                    = length(var.ingress_security_group_ids)
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.postgres.id
  source_security_group_id = var.ingress_security_group_ids[count.index]
  description              = "Postgres from app SG"
}

# ----- Redis SG: ingress 6379 from the app SG(s) only ------------------------
resource "aws_security_group" "redis" {
  name        = "${var.name_prefix}-redis-sg"
  description = "Allow Redis access from app tasks only"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, { Name = "${var.name_prefix}-redis-sg" })
}

resource "aws_security_group_rule" "redis_ingress" {
  count                    = length(var.ingress_security_group_ids)
  type                     = "ingress"
  from_port                = 6379
  to_port                  = 6379
  protocol                 = "tcp"
  security_group_id        = aws_security_group.redis.id
  source_security_group_id = var.ingress_security_group_ids[count.index]
  description              = "Redis from app SG"
}

# =============================================================================
# RDS Postgres
# =============================================================================

resource "aws_db_subnet_group" "postgres" {
  name       = "${var.name_prefix}-db-subnets"
  subnet_ids = var.private_subnet_ids
  tags       = merge(var.tags, { Name = "${var.name_prefix}-db-subnets" })
}

resource "aws_db_instance" "postgres" {
  identifier     = "${var.name_prefix}-postgres"
  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_allocated_storage * 2 # storage autoscaling cap
  storage_type          = "gp3"
  storage_encrypted     = true # encryption at rest (default KMS key)

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password # STUB / sensitive — prefer Secrets Manager + rotation

  multi_az               = var.db_multi_az
  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  vpc_security_group_ids = [aws_security_group.postgres.id]

  # Operational settings (skeleton defaults).
  backup_retention_period = 7
  deletion_protection     = false # set true in prod
  skip_final_snapshot     = true  # set false in prod
  apply_immediately       = true

  tags = merge(var.tags, { Name = "${var.name_prefix}-postgres" })
}

# =============================================================================
# ElastiCache Redis (replication group, single primary + optional replica)
# =============================================================================

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.name_prefix}-redis-subnets"
  subnet_ids = var.private_subnet_ids
  tags       = merge(var.tags, { Name = "${var.name_prefix}-redis-subnets" })
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "${var.name_prefix}-redis"
  description          = "Redis for OB-CMS (BullMQ queues + cache)"

  engine         = "redis"
  engine_version = var.redis_engine_version
  node_type      = var.redis_node_type
  port           = 6379

  # Single node group; bump replicas for HA in prod.
  num_cache_clusters         = 1
  automatic_failover_enabled = false # requires >=2 nodes; enable for prod HA

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]

  # Encryption. NOTE: in-transit TLS changes the client connection scheme;
  # ensure BullMQ/ioredis is configured for TLS if enabled.
  at_rest_encryption_enabled = true
  transit_encryption_enabled = false # STUB: enable + configure client TLS in prod

  tags = merge(var.tags, { Name = "${var.name_prefix}-redis" })
}
