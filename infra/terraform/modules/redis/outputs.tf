# infra/terraform/modules/redis/outputs.tf

output "primary_endpoint" {
  description = "Primary endpoint host (REDIS_URL). Use rediss:// (TLS) with the AUTH token."
  value       = aws_elasticache_replication_group.this.primary_endpoint_address
}

output "reader_endpoint" {
  description = "Reader endpoint host."
  value       = aws_elasticache_replication_group.this.reader_endpoint_address
}

output "port" {
  value = aws_elasticache_replication_group.this.port
}

output "security_group_id" {
  value = aws_security_group.this.id
}
