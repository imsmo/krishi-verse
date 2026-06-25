# infra/terraform/modules/waf/outputs.tf
output "web_acl_arn" {
  value       = aws_wafv2_web_acl.this.arn
  description = "Regional web ACL ARN (ALB Ingress wafv2-acl-arn annotation)."
}
