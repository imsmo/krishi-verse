# infra/terraform/modules/irsa/variables.tf · per-app IAM roles assumed by EKS service accounts (OIDC)

variable "name" {
  type        = string
  description = "Name prefix (e.g. krishiverse-prod)."
}

variable "oidc_provider_arn" {
  type        = string
  description = "EKS OIDC provider ARN (eks module output)."
}

variable "oidc_provider_url" {
  type        = string
  description = "EKS OIDC issuer URL (eks module output), e.g. https://oidc.eks.ap-south-1.amazonaws.com/id/XXXX"
}

variable "namespace" {
  type        = string
  description = "Kubernetes namespace the service accounts live in."
  default     = "krishiverse"
}

variable "kms_key_arn" {
  type        = string
  description = "Central CMK ARN — granted to apps that read encrypted secrets."
}

variable "secrets_arn_prefix" {
  type        = string
  description = "ARN wildcard for this env's Secrets Manager entries, e.g. arn:aws:secretsmanager:ap-south-1:ACCT:secret:krishiverse-prod/*"
}

variable "media_bucket_arn" {
  type        = string
  description = "Media S3 bucket ARN (api + worker get object r/w)."
}

# Service accounts that only need to READ secrets (their env). name => k8s SA name.
variable "secret_reader_service_accounts" {
  type        = list(string)
  description = "K8s SA names that read their env secret (all backend services)."
  default     = ["api", "admin-api", "wallet-service", "worker", "realtime-gateway", "ai-services"]
}

# Service accounts that additionally need S3 media object access.
variable "media_rw_service_accounts" {
  type        = list(string)
  default     = ["api", "worker"]
}

variable "tags" {
  type    = map(string)
  default = {}
}
