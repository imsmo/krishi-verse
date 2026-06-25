# infra/terraform/modules/irsa/outputs.tf

output "role_arns" {
  description = "Map of service-account name -> IAM role ARN. Use as Helm serviceAccount.roleArn."
  value       = { for sa, r in aws_iam_role.app : sa => r.arn }
}
