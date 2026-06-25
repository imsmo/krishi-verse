# infra/terraform/modules/alb-edge-iam/outputs.tf
output "lb_controller_role_arn" {
  value       = aws_iam_role.lb_controller.arn
  description = "Annotate the aws-load-balancer-controller ServiceAccount with this."
}
output "external_dns_role_arn" {
  value       = aws_iam_role.external_dns.arn
  description = "Annotate the external-dns ServiceAccount with this."
}
