# infra/terraform/modules/alb-edge-iam/main.tf · IRSA roles for the AWS Load Balancer Controller + external-dns.
terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.60" }
  }
}

locals {
  tags      = merge(var.tags, { Module = "alb-edge-iam" })
  oidc_host = replace(var.oidc_provider_url, "https://", "")
}

# ---- trust helper (one SA each) ----
data "aws_iam_policy_document" "lb_trust" {
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
      values   = ["system:serviceaccount:${var.lb_controller_namespace}:${var.lb_controller_sa}"]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_host}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

data "aws_iam_policy_document" "edns_trust" {
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
      values   = ["system:serviceaccount:${var.external_dns_namespace}:${var.external_dns_sa}"]
    }
    condition {
      test     = "StringEquals"
      variable = "${local.oidc_host}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

# ---- AWS Load Balancer Controller role + policy ----
# Permissions derived from the official AWSLoadBalancerControllerIAMPolicy. Periodically re-sync from upstream.
resource "aws_iam_role" "lb_controller" {
  name               = "${var.name}-alb-controller"
  assume_role_policy = data.aws_iam_policy_document.lb_trust.json
  tags               = local.tags
}

data "aws_iam_policy_document" "lb_controller" {
  statement {
    effect    = "Allow"
    actions   = ["iam:CreateServiceLinkedRole"]
    resources = ["*"]
    condition {
      test     = "StringEquals"
      variable = "iam:AWSServiceName"
      values   = ["elasticloadbalancing.amazonaws.com"]
    }
  }
  statement {
    effect = "Allow"
    actions = [
      "ec2:DescribeAccountAttributes", "ec2:DescribeAddresses", "ec2:DescribeAvailabilityZones",
      "ec2:DescribeInternetGateways", "ec2:DescribeVpcs", "ec2:DescribeVpcPeeringConnections",
      "ec2:DescribeSubnets", "ec2:DescribeSecurityGroups", "ec2:DescribeInstances",
      "ec2:DescribeNetworkInterfaces", "ec2:DescribeTags", "ec2:GetCoipPoolUsage",
      "ec2:DescribeCoipPools", "ec2:GetSecurityGroupsForVpc",
      "elasticloadbalancing:DescribeLoadBalancers", "elasticloadbalancing:DescribeLoadBalancerAttributes",
      "elasticloadbalancing:DescribeListeners", "elasticloadbalancing:DescribeListenerCertificates",
      "elasticloadbalancing:DescribeSSLPolicies", "elasticloadbalancing:DescribeRules",
      "elasticloadbalancing:DescribeTargetGroups", "elasticloadbalancing:DescribeTargetGroupAttributes",
      "elasticloadbalancing:DescribeTargetHealth", "elasticloadbalancing:DescribeTags",
      "elasticloadbalancing:DescribeListenerAttributes"
    ]
    resources = ["*"]
  }
  statement {
    effect = "Allow"
    actions = [
      "cognito-idp:DescribeUserPoolClient", "acm:ListCertificates", "acm:DescribeCertificate",
      "iam:ListServerCertificates", "iam:GetServerCertificate", "waf-regional:GetWebACL",
      "waf-regional:GetWebACLForResource", "waf-regional:AssociateWebACL", "waf-regional:DisassociateWebACL",
      "wafv2:GetWebACL", "wafv2:GetWebACLForResource", "wafv2:AssociateWebACL", "wafv2:DisassociateWebACL",
      "shield:GetSubscriptionState", "shield:DescribeProtection", "shield:CreateProtection",
      "shield:DeleteProtection"
    ]
    resources = ["*"]
  }
  statement {
    effect = "Allow"
    actions = [
      "ec2:AuthorizeSecurityGroupIngress", "ec2:RevokeSecurityGroupIngress", "ec2:CreateSecurityGroup",
      "ec2:CreateTags", "ec2:DeleteTags", "ec2:DeleteSecurityGroup",
      "elasticloadbalancing:CreateLoadBalancer", "elasticloadbalancing:CreateTargetGroup",
      "elasticloadbalancing:CreateListener", "elasticloadbalancing:DeleteListener",
      "elasticloadbalancing:CreateRule", "elasticloadbalancing:DeleteRule",
      "elasticloadbalancing:AddTags", "elasticloadbalancing:RemoveTags",
      "elasticloadbalancing:ModifyLoadBalancerAttributes", "elasticloadbalancing:SetIpAddressType",
      "elasticloadbalancing:SetSecurityGroups", "elasticloadbalancing:SetSubnets",
      "elasticloadbalancing:DeleteLoadBalancer", "elasticloadbalancing:ModifyTargetGroup",
      "elasticloadbalancing:ModifyTargetGroupAttributes", "elasticloadbalancing:DeleteTargetGroup",
      "elasticloadbalancing:ModifyListenerAttributes",
      "elasticloadbalancing:RegisterTargets", "elasticloadbalancing:DeregisterTargets",
      "elasticloadbalancing:ModifyListener", "elasticloadbalancing:AddListenerCertificates",
      "elasticloadbalancing:RemoveListenerCertificates", "elasticloadbalancing:ModifyRule",
      "elasticloadbalancing:SetWebAcl"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "lb_controller" {
  name   = "${var.name}-alb-controller"
  policy = data.aws_iam_policy_document.lb_controller.json
  tags   = local.tags
}

resource "aws_iam_role_policy_attachment" "lb_controller" {
  role       = aws_iam_role.lb_controller.name
  policy_arn = aws_iam_policy.lb_controller.arn
}

# ---- external-dns role + policy (scoped to the one zone) ----
resource "aws_iam_role" "external_dns" {
  name               = "${var.name}-external-dns"
  assume_role_policy = data.aws_iam_policy_document.edns_trust.json
  tags               = local.tags
}

data "aws_iam_policy_document" "external_dns" {
  statement {
    effect    = "Allow"
    actions   = ["route53:ChangeResourceRecordSets"]
    resources = [var.hosted_zone_arn]
  }
  statement {
    effect    = "Allow"
    actions   = ["route53:ListHostedZones", "route53:ListResourceRecordSets", "route53:ListTagsForResources"]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "external_dns" {
  name   = "${var.name}-external-dns"
  policy = data.aws_iam_policy_document.external_dns.json
  tags   = local.tags
}

resource "aws_iam_role_policy_attachment" "external_dns" {
  role       = aws_iam_role.external_dns.name
  policy_arn = aws_iam_policy.external_dns.arn
}
