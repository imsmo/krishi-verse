# infra/terraform/modules/s3-cdn/outputs.tf

output "media_bucket_name" {
  description = "Media bucket name (S3_BUCKET for presigned media)."
  value       = aws_s3_bucket.media.id
}

output "media_bucket_arn" {
  value = aws_s3_bucket.media.arn
}

output "logs_bucket_name" {
  value = aws_s3_bucket.logs.id
}
