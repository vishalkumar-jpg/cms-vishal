# modules/security/main.tf
# -----------------------------------------------------------------------------
# Secrets, config, and IAM for the ECS workloads.
#
#   - Secrets Manager: app secrets created with STUB values. Real values are
#     set OUT-OF-BAND (aws secretsmanager put-secret-value) so they never live
#     in Terraform state in plaintext.
#   - SSM Parameter Store: non-secret config (log level, feature flags).
#   - IAM: ecs_task_execution_role (pull images + read secrets at startup) and
#     ecs_task_role (app runtime perms: S3 media).
# -----------------------------------------------------------------------------

data "aws_caller_identity" "current" {}

locals {
  # Logical names of the secrets the app expects.
  secret_names = ["JWT_SECRET", "DATABASE_URL", "ENCRYPTION_KEY", "CRM_HMAC_SECRET"]
}

# =============================================================================
# Secrets Manager (STUB values — overwritten out-of-band)
# =============================================================================

resource "aws_secretsmanager_secret" "app" {
  for_each    = toset(local.secret_names)
  name        = "${var.name_prefix}/${each.value}"
  description = "OB-CMS ${each.value} (value set out-of-band; STUB here)."
  tags        = merge(var.tags, { Name = "${var.name_prefix}-${lower(each.value)}" })
}

# Initial placeholder version. The real value MUST be set out-of-band, e.g.:
#   aws secretsmanager put-secret-value --secret-id ob-cms-dev/JWT_SECRET \
#     --secret-string "$(openssl rand -hex 32)"
# We avoid committing real secrets; Terraform should NOT manage their content.
resource "aws_secretsmanager_secret_version" "app_stub" {
  for_each      = aws_secretsmanager_secret.app
  secret_id     = each.value.id
  secret_string = "STUB-set-out-of-band"

  # Ignore drift on the value so out-of-band updates aren't reverted by TF.
  lifecycle {
    ignore_changes = [secret_string]
  }
}

# =============================================================================
# SSM Parameter Store (non-secret config)
# =============================================================================

resource "aws_ssm_parameter" "log_level" {
  name  = "/${var.name_prefix}/config/LOG_LEVEL"
  type  = "String"
  value = "info"
  tags  = var.tags
}

resource "aws_ssm_parameter" "node_env" {
  name  = "/${var.name_prefix}/config/NODE_ENV"
  type  = "String"
  value = "production"
  tags  = var.tags
}

# =============================================================================
# IAM: ECS task execution role (used by the ECS agent, not the app)
# =============================================================================

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_task_execution" {
  name               = "${var.name_prefix}-ecs-exec-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = var.tags
}

# AWS-managed base policy: ECR pull + CloudWatch Logs.
resource "aws_iam_role_policy_attachment" "exec_managed" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Allow the execution role to read the app secrets at container startup
# (injected via task definition `secrets.valueFrom`).
data "aws_iam_policy_document" "exec_secrets" {
  statement {
    sid       = "ReadAppSecrets"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [for s in aws_secretsmanager_secret.app : s.arn]
  }
  statement {
    sid       = "ReadSsmConfig"
    effect    = "Allow"
    actions   = ["ssm:GetParameters", "ssm:GetParameter"]
    resources = ["arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter/${var.name_prefix}/config/*"]
  }
}

resource "aws_iam_role_policy" "exec_secrets" {
  name   = "${var.name_prefix}-exec-secrets"
  role   = aws_iam_role.ecs_task_execution.id
  policy = data.aws_iam_policy_document.exec_secrets.json
}

# =============================================================================
# IAM: ECS task role (assumed by the running application code)
# =============================================================================

resource "aws_iam_role" "ecs_task" {
  name               = "${var.name_prefix}-ecs-task-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
  tags               = var.tags
}

# App runtime permissions: read/write media in S3.
data "aws_iam_policy_document" "task_s3" {
  statement {
    sid    = "MediaBucketObjects"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
    ]
    resources = ["${var.media_bucket_arn}/*"]
  }
  statement {
    sid       = "MediaBucketList"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [var.media_bucket_arn]
  }
}

resource "aws_iam_role_policy" "task_s3" {
  name   = "${var.name_prefix}-task-s3"
  role   = aws_iam_role.ecs_task.id
  policy = data.aws_iam_policy_document.task_s3.json
}
