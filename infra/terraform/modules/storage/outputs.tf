# modules/storage/outputs.tf

output "bucket_id" {
  description = "Name (id) of the media S3 bucket."
  value       = aws_s3_bucket.media.id
}

output "bucket_arn" {
  description = "ARN of the media S3 bucket."
  value       = aws_s3_bucket.media.arn
}

output "bucket_domain_name" {
  description = "Global domain name of the bucket."
  value       = aws_s3_bucket.media.bucket_domain_name
}

output "bucket_regional_domain_name" {
  description = "Regional domain name of the bucket (use as the CloudFront S3 origin domain)."
  value       = aws_s3_bucket.media.bucket_regional_domain_name
}
