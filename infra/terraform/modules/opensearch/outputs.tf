# infra/terraform/modules/opensearch/outputs.tf

output "endpoint" {
  description = "OpenSearch VPC endpoint host (OPENSEARCH_URL = https://<this>)."
  value       = aws_opensearch_domain.this.endpoint
}

output "domain_arn" {
  value = aws_opensearch_domain.this.arn
}

output "security_group_id" {
  value = aws_security_group.this.id
}
