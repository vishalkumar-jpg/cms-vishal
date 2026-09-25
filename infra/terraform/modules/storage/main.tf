# modules/storage/main.tf
# -----------------------------------------------------------------------------
# S3 bucket for tenant media (images, uploads). Objects are PRIVATE and served
# ONLY through CloudFront via an Origin Access Control (OAC) — never directly.
# -----------------------------------------------------------------------------

# Random suffix to make the bucket name globally unique.
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "media" {
  bucket = "${var.name_prefix}-media-${random_id.bucket_suffix.hex}"
  tags   = merge(var.tags, { Name = "${var.name_prefix}-media" })
}

# ----- Versioning (recover overwritten/deleted media) ------------------------
resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  versioning_configuration {
    status = "Enabled"
  }
}

# ----- Server-side encryption (SSE-S3 / AES256) ------------------------------
resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# ----- Ownership controls (disable ACLs; bucket owner owns all objects) -------
resource "aws_s3_bucket_ownership_controls" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# ----- Block ALL public access (objects reachable only via CloudFront OAC) ----
resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ----- Bucket policy --------------------------------------------------------
# DECOUPLING NOTE (cycle break): the bucket policy that grants the CloudFront
# OAC read access lives in the `cdn` module, NOT here. If storage referenced the
# distribution ARN while cdn referenced the bucket, Terraform would see a module
# cycle (storage <-> cdn). The `cdn` module owns BOTH the distribution and the
# bucket id (passed in), so it attaches `aws_s3_bucket_policy.media_oac` there.
# This module just exports the bucket identifiers below.
