# infra/terraform/modules/dns/outputs.tf
output "zone_id" {
  value       = aws_route53_zone.this.zone_id
  description = "Route 53 hosted zone id."
}
output "zone_name" {
  value = aws_route53_zone.this.name
}
output "name_servers" {
  value       = aws_route53_zone.this.name_servers
  description = "Set these 4 NS records at your registrar to delegate the domain to Route 53."
}
