# infra/terraform/modules/vpc/outputs.tf

output "vpc_id" {
  description = "VPC id."
  value       = aws_vpc.this.id
}

output "vpc_cidr_block" {
  description = "VPC primary CIDR."
  value       = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  description = "Public subnet ids (ALB, NAT)."
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet ids (EKS nodes, app pods)."
  value       = aws_subnet.private[*].id
}

output "data_subnet_ids" {
  description = "Isolated data subnet ids (Aurora, Redis, OpenSearch)."
  value       = aws_subnet.data[*].id
}

output "availability_zones" {
  description = "AZs in use."
  value       = local.azs
}
