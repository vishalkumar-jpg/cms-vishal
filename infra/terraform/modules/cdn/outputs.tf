# modules/cdn/outputs.tf

output "cloudfront_domain" {
  description = "CloudFront distribution domain name (point DNS here)."
  value       = aws_cloudfront_distribution.this.domain_name
}

output "distribution_id" {
  description = "CloudFront distribution ID."
  value       = aws_cloudfront_distribution.this.id
}

output "distribution_arn" {
  description = "CloudFront distribution ARN (used in the S3 bucket policy SourceArn)."
  value       = aws_cloudfront_distribution.this.arn
}

output "waf_acl_arn" {
  description = "WAFv2 web ACL ARN."
  value       = aws_wafv2_web_acl.this.arn
}

output "acm_cert_arn" {
  description = "ACM certificate ARN (wildcard SAN for tenant subdomains)."
  value       = aws_acm_certificate.this.arn
}
