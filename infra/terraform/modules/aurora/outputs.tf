# infra/terraform/modules/aurora/outputs.tf

output "cluster_endpoint" {
  description = "Writer endpoint (DATABASE_URL host for migrations/writes)."
  value       = aws_rds_cluster.this.endpoint
}

output "reader_endpoint" {
  description = "Reader endpoint (READ_REPLICA host for CQRS reads)."
  value       = aws_rds_cluster.this.reader_endpoint
}

output "port" {
  value = aws_rds_cluster.this.port
}

output "database_name" {
  value = aws_rds_cluster.this.database_name
}

output "master_user_secret_arn" {
  description = "Secrets Manager ARN holding the AWS-managed master credentials."
  value       = aws_rds_cluster.this.master_user_secret[0].secret_arn
}

output "security_group_id" {
  description = "Aurora SG id."
  value       = aws_security_group.this.id
}
