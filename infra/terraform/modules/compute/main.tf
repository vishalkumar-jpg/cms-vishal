# modules/compute/main.tf
# -----------------------------------------------------------------------------
# Compute layer: ALB + ECS Fargate cluster running three services.
#
#   - renderer (Next.js, :3000)  -> ALB default route, target group
#   - api      (NestJS,  :3001)  -> ALB /api/* route, target group
#   - worker   (BullMQ)          -> NO load balancer, NO public port
#
# Secrets are injected into containers via `secrets.valueFrom` (Secrets Manager).
# Backing endpoints (DB/Redis host:port) are passed as plain `environment`.
# -----------------------------------------------------------------------------

locals {
  # Port each HTTP service listens on inside the container.
  api_port      = 3001
  renderer_port = 3000

  # Common non-secret env shared by all services.
  #
  # DECOUPLING NOTE (cycle break): DB/Redis connection details are NOT passed in
  # here as direct module references. data -> compute (the ECS SG is the only DB
  # ingress) is the load-bearing edge; if compute also referenced data's
  # endpoints, the two modules would form a cycle. Instead the app receives
  # DATABASE_URL / REDIS_URL from Secrets Manager (injected via container_secrets
  # below) — which is also the more secure place for a connection string.
  common_env = [
    { name = "NODE_ENV", value = "production" },
    { name = "AWS_REGION", value = var.region },
  ]

  # Secrets list for task defs: [{ name = "JWT_SECRET", valueFrom = "<arn>" }, ...]
  container_secrets = [for k, arn in var.secret_arns : { name = k, valueFrom = arn }]
}

# =============================================================================
# Regional ACM certificate for the ALB HTTPS listener
# -----------------------------------------------------------------------------
# DECOUPLING NOTE (cycle break): the ALB needs a REGIONAL cert, while CloudFront
# needs a us-east-1 cert. Issuing the ALB's cert here (instead of reusing the
# cdn module's cert) keeps compute independent of cdn — otherwise compute -> cdn
# (cert) and cdn -> compute (alb_dns_name) would form a module cycle. DNS
# validation is STUBBED (see the commented Route53 records in the cdn module).
# =============================================================================
resource "aws_acm_certificate" "alb" {
  domain_name               = var.root_domain
  subject_alternative_names = ["*.${var.root_domain}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-alb-cert" })
}

# =============================================================================
# Security groups
# =============================================================================

# ALB SG: allow inbound 80/443 from the internet.
resource "aws_security_group" "alb" {
  name        = "${var.name_prefix}-alb-sg"
  description = "ALB ingress 80/443 from internet"
  vpc_id      = var.vpc_id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-alb-sg" })
}

# ECS service SG: allow inbound only from the ALB SG (on the app ports).
resource "aws_security_group" "ecs_service" {
  name        = "${var.name_prefix}-ecs-service-sg"
  description = "ECS tasks; ingress from ALB only"
  vpc_id      = var.vpc_id

  egress {
    description = "All outbound (ECR pull, secrets, DB, Redis, internet via NAT)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-ecs-service-sg" })
}

# Ingress to api + renderer ports from the ALB SG.
resource "aws_security_group_rule" "ecs_from_alb_api" {
  type                     = "ingress"
  from_port                = local.api_port
  to_port                  = local.api_port
  protocol                 = "tcp"
  security_group_id        = aws_security_group.ecs_service.id
  source_security_group_id = aws_security_group.alb.id
  description              = "api port from ALB"
}

resource "aws_security_group_rule" "ecs_from_alb_renderer" {
  type                     = "ingress"
  from_port                = local.renderer_port
  to_port                  = local.renderer_port
  protocol                 = "tcp"
  security_group_id        = aws_security_group.ecs_service.id
  source_security_group_id = aws_security_group.alb.id
  description              = "renderer port from ALB"
}

# =============================================================================
# Application Load Balancer
# =============================================================================

resource "aws_lb" "this" {
  name               = "${var.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids

  tags = merge(var.tags, { Name = "${var.name_prefix}-alb" })
}

# ----- Target groups (ip target type for Fargate) ----------------------------
resource "aws_lb_target_group" "renderer" {
  name        = "${var.name_prefix}-renderer-tg"
  port        = local.renderer_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/"
    matcher             = "200-399"
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-renderer-tg" })
}

resource "aws_lb_target_group" "api" {
  name        = "${var.name_prefix}-api-tg"
  port        = local.api_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/api/health" # STUB: ensure NestJS exposes this
    matcher             = "200"
    interval            = 30
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-api-tg" })
}

# ----- Listeners -------------------------------------------------------------
# HTTP :80 -> redirect to HTTPS.
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS :443 -> default to renderer; /api/* rule to api.
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.alb.arn # regional cert (STUB validation)

  # Default action -> renderer.
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.renderer.arn
  }
}

# Path-based rule: /api/* -> api target group.
resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

# =============================================================================
# CloudWatch log groups (one per service)
# =============================================================================
resource "aws_cloudwatch_log_group" "service" {
  for_each          = toset(["api", "worker", "renderer"])
  name              = "/ecs/${var.name_prefix}/${each.value}"
  retention_in_days = 30
  tags              = var.tags
}

# =============================================================================
# ECS cluster
# =============================================================================
resource "aws_ecs_cluster" "this" {
  name = "${var.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-cluster" })
}

# =============================================================================
# Task definitions
# =============================================================================

# ----- api (NestJS :3001) ----------------------------------------------------
resource "aws_ecs_task_definition" "api" {
  family                   = "${var.name_prefix}-api"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = var.api_image # STUB tag
      essential = true
      portMappings = [
        { containerPort = local.api_port, protocol = "tcp" }
      ]
      environment = local.common_env
      secrets     = local.container_secrets
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.service["api"].name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "api"
        }
      }
    }
  ])

  tags = var.tags
}

# ----- worker (BullMQ, NO ports) ---------------------------------------------
resource "aws_ecs_task_definition" "worker" {
  family                   = "${var.name_prefix}-worker"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = var.worker_image # STUB tag
      essential = true
      # NO portMappings: worker is not reachable and has no LB.
      environment = local.common_env
      secrets     = local.container_secrets
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.service["worker"].name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "worker"
        }
      }
    }
  ])

  tags = var.tags
}

# ----- renderer (Next.js :3000) ----------------------------------------------
resource "aws_ecs_task_definition" "renderer" {
  family                   = "${var.name_prefix}-renderer"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "renderer"
      image     = var.renderer_image # STUB tag
      essential = true
      portMappings = [
        { containerPort = local.renderer_port, protocol = "tcp" }
      ]
      environment = local.common_env
      secrets     = local.container_secrets
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.service["renderer"].name
          "awslogs-region"        = var.region
          "awslogs-stream-prefix" = "renderer"
        }
      }
    }
  ])

  tags = var.tags
}

# =============================================================================
# ECS services
# =============================================================================

# ----- api service: attached to api target group -----------------------------
resource "aws_ecs_service" "api" {
  name            = "${var.name_prefix}-api"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.desired_count.api
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_service.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = local.api_port
  }

  # Ensure the listener rule exists before the service registers targets.
  depends_on = [aws_lb_listener_rule.api]

  tags = var.tags
}

# ----- renderer service: attached to renderer target group -------------------
resource "aws_ecs_service" "renderer" {
  name            = "${var.name_prefix}-renderer"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.renderer.arn
  desired_count   = var.desired_count.renderer
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_service.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.renderer.arn
    container_name   = "renderer"
    container_port   = local.renderer_port
  }

  depends_on = [aws_lb_listener.https]

  tags = var.tags
}

# ----- worker service: NO load_balancer block (background processor) ----------
resource "aws_ecs_service" "worker" {
  name            = "${var.name_prefix}-worker"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.desired_count.worker
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs_service.id]
    assign_public_ip = false
  }

  # Intentionally no load_balancer{} — worker has no public port.

  tags = var.tags
}
