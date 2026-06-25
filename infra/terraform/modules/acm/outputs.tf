# infra/terraform/modules/acm/outputs.tf
output "certificate_arn" {
  value       = aws_acm_certificate_validation.this.certificate_arn
  description = "Validated ACM cert ARN (use in the ALB Ingress certificate-arn annotation)."
}
