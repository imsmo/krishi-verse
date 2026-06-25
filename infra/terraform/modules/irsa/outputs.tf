# infra/terraform/modules/irsa/outputs.tf

output "role_arns" {
  description = "Map of service-account name -> IAM role ARN. Use as Helm serviceAccount.roleArn."
  value       = { for sa, r in aws_iam_role.app : sa => r.arn }
}

output "external_secrets_role_arn" {
  description = "Annotate the External Secrets Operator controller ServiceAccount (external-secrets/external-secrets) with this."
  value       = aws_iam_role.eso.arn
}
