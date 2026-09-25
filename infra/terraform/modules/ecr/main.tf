# modules/ecr/main.tf
# -----------------------------------------------------------------------------
# One ECR repository per deployable container service. Scan-on-push enabled and
# a lifecycle policy that prunes all but the last N images.
# -----------------------------------------------------------------------------

resource "aws_ecr_repository" "this" {
  for_each = toset(var.repositories)

  name = "${var.name_prefix}-${each.value}"

  # IMMUTABLE prevents overwriting an existing tag — good for reproducible
  # deploys, but means CI must push unique tags (e.g. git SHA). STUB tags in
  # the root vars use ":STUB"; replace with real immutable tags in CI.
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-${each.value}" })
}

# Keep only the last N images; expire older ones to control storage cost.
resource "aws_ecr_lifecycle_policy" "this" {
  for_each   = aws_ecr_repository.this
  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last ${var.keep_last_images} images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = var.keep_last_images
        }
        action = { type = "expire" }
      }
    ]
  })
}
