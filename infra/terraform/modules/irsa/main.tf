# infra/terraform/modules/irsa/main.tf · IAM Roles for Service Accounts (least-privilege, no static keys)
#
# Each backend SA gets a role it can assume via the cluster OIDC provider. Roles grant ONLY:
#   - decrypt with the platform CMK + read this env's Secrets Manager entries (their env secret)
#   - (api, worker) read/write objects in the media bucket
# Annotate the K8s ServiceAccount with the role ARN (Helm serviceAccount.roleArn).

terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
  }
}

locals {
  tags = merge(var.tags, { "Module" = "irsa" })
  # strip scheme from issuer for the condition keys (sub/aud)
  oidc_host = replace(var.oidc_provider_url, "https://", "")
}

# Trust policy generator: allow a specific namespace/serviceaccount to assume the role via OIDC.
data "aws_iam_policy_document" "trust" {
  for_each = toset(var.secret_reader_service_accounts)

  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [var.oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_host}:sub"
      values   = ["system:serviceaccount:${var.namespace}:${each.value}"]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_host}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "app" {
  for_each           = toset(var.secret_reader_service_accounts)
  name               = "${var.name}-irsa-${each.value}"
  assume_role_policy = data.aws_iam_policy_document.trust[each.value].json
  tags               = local.tags
}

# Secrets read + KMS decrypt (every backend service)
data "aws_iam_policy_document" "secrets_read" {
  statement {
    sid       = "ReadEnvSecrets"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue", "secretsmanager:DescribeSecret"]
    resources = [var.secrets_arn_prefix]
  }
  statement {
    sid       = "DecryptWithCmk"
    effect    = "Allow"
    actions   = ["kms:Decrypt", "kms:DescribeKey"]
    resources = [var.kms_key_arn]
  }
}

resource "aws_iam_policy" "secrets_read" {
  name   = "${var.name}-irsa-secrets-read"
  policy = data.aws_iam_policy_document.secrets_read.json
  tags   = local.tags
}

resource "aws_iam_role_policy_attachment" "secrets_read" {
  for_each   = toset(var.secret_reader_service_accounts)
  role       = aws_iam_role.app[each.value].name
  policy_arn = aws_iam_policy.secrets_read.arn
}

# S3 media object r/w (api, worker only)
data "aws_iam_policy_document" "media_rw" {
  statement {
    sid       = "MediaObjects"
    effect    = "Allow"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${var.media_bucket_arn}/*"]
  }
  statement {
    sid       = "MediaList"
    effect    = "Allow"
    actions   = ["s3:ListBucket"]
    resources = [var.media_bucket_arn]
  }
  statement {
    sid       = "MediaKms"
    effect    = "Allow"
    actions   = ["kms:GenerateDataKey", "kms:Decrypt"]
    resources = [var.kms_key_arn]
  }
}

resource "aws_iam_policy" "media_rw" {
  name   = "${var.name}-irsa-media-rw"
  policy = data.aws_iam_policy_document.media_rw.json
  tags   = local.tags
}

resource "aws_iam_role_policy_attachment" "media_rw" {
  for_each   = toset([for sa in var.media_rw_service_accounts : sa if contains(var.secret_reader_service_accounts, sa)])
  role       = aws_iam_role.app[each.value].name
  policy_arn = aws_iam_policy.media_rw.arn
}

# ---- External Secrets Operator controller role (syncs Secrets Manager -> k8s Secrets) ----
data "aws_iam_policy_document" "eso_trust" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [var.oidc_provider_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_host}:sub"
      values   = ["system:serviceaccount:${var.eso_namespace}:${var.eso_service_account}"]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_host}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "eso" {
  name               = "${var.name}-irsa-external-secrets"
  assume_role_policy = data.aws_iam_policy_document.eso_trust.json
  tags               = local.tags
}

resource "aws_iam_role_policy_attachment" "eso_secrets_read" {
  role       = aws_iam_role.eso.name
  policy_arn = aws_iam_policy.secrets_read.arn
}
