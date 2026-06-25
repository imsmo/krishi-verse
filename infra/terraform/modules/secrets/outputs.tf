# infra/terraform/modules/secrets/outputs.tf

output "kms_key_arn" {
  description = "Central CMK ARN (feed to aurora/redis/opensearch/eks/s3 modules)."
  value       = aws_kms_key.main.arn
}

output "kms_key_id" {
  value = aws_kms_key.main.key_id
}

output "jwt_access_secret_arn" {
  value = aws_secretsmanager_secret.jwt_access.arn
}

output "api_shared_secret_arn" {
  value = aws_secretsmanager_secret.api_shared.arn
}

output "external_secret_arns" {
  description = "Map of external provider secret name -> ARN (populate values via CLI)."
  value       = { for k, v in aws_secretsmanager_secret.external : k => v.arn }
}
