# modules/cdn/main.tf
# -----------------------------------------------------------------------------
# Edge layer: ACM cert + CloudFront distribution + WAFv2 web ACL.
#
#   - ACM cert for root_domain + *.root_domain (wildcard SAN covers per-tenant
#     subdomains via SNI). DNS validation is STUBBED/commented.
#   - CloudFront with TWO origins:
#       * ALB  (custom origin, HTTPS)  -> default + /api/* behaviors
#       * S3   (OAC origin)            -> /media/* behavior (private bucket)
#   - WAFv2 web ACL: AWS managed common rule set + a rate-based rule.
#
# IMPORTANT: CloudFront ACM certs and the CloudFront-scoped WAF web ACL MUST be
# in us-east-1. This skeleton assumes the default provider is us-east-1. If not,
# pass an aliased us-east-1 provider into this module.
# -----------------------------------------------------------------------------

locals {
  alb_origin_id = "${var.name_prefix}-alb-origin"
  s3_origin_id  = "${var.name_prefix}-s3-media-origin"
}

# =============================================================================
# ACM certificate (DNS validated) — wildcard SAN for tenant subdomains
# =============================================================================
resource "aws_acm_certificate" "this" {
  domain_name               = var.root_domain
  subject_alternative_names = ["*.${var.root_domain}"] # covers tenant subdomains
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-cert" })
}

# ----- DNS validation (STUBBED) ----------------------------------------------
# In a real setup you create the CNAME validation records in Route53 (or your
# DNS provider) from aws_acm_certificate.this.domain_validation_options, then
# wait on aws_acm_certificate_validation. We comment these out because no hosted
# zone exists in this skeleton.
#
# resource "aws_route53_record" "cert_validation" {
#   for_each = {
#     for dvo in aws_acm_certificate.this.domain_validation_options :
#     dvo.domain_name => {
#       name   = dvo.resource_record_name
#       type   = dvo.resource_record_type
#       record = dvo.resource_record_value
#     }
#   }
#   zone_id = "STUB_HOSTED_ZONE_ID"
#   name    = each.value.name
#   type    = each.value.type
#   records = [each.value.record]
#   ttl     = 60
# }
#
# resource "aws_acm_certificate_validation" "this" {
#   certificate_arn         = aws_acm_certificate.this.arn
#   validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]
# }

# =============================================================================
# Origin Access Control (OAC) for the private S3 media bucket
# =============================================================================
resource "aws_cloudfront_origin_access_control" "media" {
  name                              = "${var.name_prefix}-media-oac"
  description                       = "OAC for OB-CMS media bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# =============================================================================
# WAFv2 web ACL (CLOUDFRONT scope -> must be us-east-1)
# =============================================================================
resource "aws_wafv2_web_acl" "this" {
  name        = "${var.name_prefix}-waf"
  description = "WAF for OB-CMS CloudFront"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # AWS managed common rule set.
  rule {
    name     = "AWSManagedCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-common"
      sampled_requests_enabled   = true
    }
  }

  # Rate-based rule: block IPs exceeding waf_rate_limit per 5-minute window.
  rule {
    name     = "RateLimitPerIP"
    priority = 2

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = var.waf_rate_limit
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-ratelimit"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name_prefix}-waf"
    sampled_requests_enabled   = true
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-waf" })
}

# =============================================================================
# CloudFront distribution
# =============================================================================
resource "aws_cloudfront_distribution" "this" {
  enabled         = true
  is_ipv6_enabled = true
  comment         = "OB-CMS ${var.name_prefix} edge"

  # Aliases: apex + wildcard so all tenant subdomains resolve here (SNI).
  aliases = [var.domain, var.root_domain, "*.${var.root_domain}"]

  # ----- Origin 1: ALB (dynamic app: renderer + api) -------------------------
  origin {
    domain_name = var.alb_dns_name
    origin_id   = local.alb_origin_id

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only" # CloudFront -> ALB over TLS
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # ----- Origin 2: S3 media bucket (private, via OAC) ------------------------
  origin {
    domain_name              = var.s3_bucket_regional_domain_name
    origin_id                = local.s3_origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.media.id
  }

  # ----- Default behavior: forward to ALB (renderer) -------------------------
  default_cache_behavior {
    target_origin_id       = local.alb_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]

    # AWS managed policies (stable IDs).
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_optimized.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  # ----- /api/* behavior: ALB, NO caching ------------------------------------
  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = local.alb_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer.id
  }

  # ----- /media/* behavior: S3 origin, immutable long-cache ------------------
  ordered_cache_behavior {
    path_pattern           = "/media/*"
    target_origin_id       = local.s3_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]

    cache_policy_id = data.aws_cloudfront_cache_policy.caching_optimized.id
  }

  # Attach the WAF web ACL.
  web_acl_id = aws_wafv2_web_acl.this.arn

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # ----- TLS: use the ACM cert (SNI). Validation is STUBBED. -----------------
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.this.arn # STUB: not validated yet
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = merge(var.tags, { Name = "${var.name_prefix}-cdn" })
}

# =============================================================================
# AWS managed cache / origin-request policies (data sources)
# =============================================================================
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewer"
}

# =============================================================================
# S3 media bucket policy — grant ONLY this distribution's OAC read access.
# -----------------------------------------------------------------------------
# This policy lives HERE (not in the storage module) to break a module cycle:
# the policy needs the distribution ARN, and the distribution needs the bucket
# domain. The cdn module owns the distribution and receives the bucket id/arn as
# inputs, so it can attach the policy without a back-reference into storage.
# =============================================================================
data "aws_iam_policy_document" "media_oac" {
  statement {
    sid     = "AllowCloudFrontOACRead"
    effect  = "Allow"
    actions = ["s3:GetObject"]

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    resources = ["${var.s3_bucket_arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.this.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "media_oac" {
  bucket = var.s3_bucket_id
  policy = data.aws_iam_policy_document.media_oac.json
}
