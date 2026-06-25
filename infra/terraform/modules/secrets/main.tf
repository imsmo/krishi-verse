# infra/terraform/modules/secrets/main.tf · central KMS CMK + Secrets Manager
#
# - One customer-managed KMS key (rotated yearly) used to encrypt Aurora/Redis/OpenSearch/EKS-secrets/S3.
# - Internal secrets (JWT access secret, s2s API shared secret) are GENERATED here (strong random) so no human
#   ever knows or commits them. They live only in encrypted state + Secrets Manager.
# - External provider secrets are created as EMPTY containers; you set their values out-of-band (CLI/console).
#   TF ignores later value changes so it never clobbers what you set. (Contract: secrets never in git.)

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

locals {
  tags = merge(var.tags, { "Module" = "secrets" })
}

data "aws_caller_identity" "current" {}

resource "aws_kms_key" "main" {
  description             = "${var.name} platform CMK (data-at-rest + secrets)"
  enable_key_rotation     = true
  deletion_window_in_days = 30
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "EnableRoot"
      Effect    = "Allow"
      Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
      Action    = "kms:*"
      Resource  = "*"
    }]
  })
  tags = local.tags
}

resource "aws_kms_alias" "main" {
  name          = "alias/${var.name}-main"
  target_key_id = aws_kms_key.main.key_id
}

# ---------- Generated internal secrets ----------
resource "random_password" "jwt_access" {
  length  = var.generated_secret_length
  special = false # base62 — safe in env/header without escaping, still >32 chars
}

resource "random_password" "api_shared" {
  length  = var.generated_secret_length
  special = false
}

resource "aws_secretsmanager_secret" "jwt_access" {
  name                    = "${var.name}/jwt/access_secret"
  kms_key_id              = aws_kms_key.main.arn
  recovery_window_in_days = var.recovery_window_days
  tags                    = local.tags
}

resource "aws_secretsmanager_secret_version" "jwt_access" {
  secret_id     = aws_secretsmanager_secret.jwt_access.id
  secret_string = random_password.jwt_access.result
}

resource "aws_secretsmanager_secret" "api_shared" {
  name                    = "${var.name}/api/shared_secret"
  kms_key_id              = aws_kms_key.main.arn
  recovery_window_in_days = var.recovery_window_days
  tags                    = local.tags
}

resource "aws_secretsmanager_secret_version" "api_shared" {
  secret_id     = aws_secretsmanager_secret.api_shared.id
  secret_string = random_password.api_shared.result
}

# ---------- External provider secret containers (values set manually) ----------
resource "aws_secretsmanager_secret" "external" {
  for_each                = toset(var.external_secret_names)
  name                    = "${var.name}/${each.value}"
  kms_key_id              = aws_kms_key.main.arn
  recovery_window_in_days = var.recovery_window_days
  tags                    = local.tags
}

resource "aws_secretsmanager_secret_version" "external_placeholder" {
  for_each      = aws_secretsmanager_secret.external
  secret_id     = each.value.id
  secret_string = "SET_ME_VIA_CLI" # placeholder; populate out-of-band

  lifecycle {
    ignore_changes = [secret_string] # never overwrite the real value you set later
  }
}
