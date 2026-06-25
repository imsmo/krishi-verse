# infra/terraform/modules/alb-edge-iam/variables.tf
variable "name" {
  type = string
}
variable "oidc_provider_arn" {
  type = string
}
variable "oidc_provider_url" {
  type = string
}
variable "lb_controller_namespace" {
  type    = string
  default = "kube-system"
}
variable "lb_controller_sa" {
  type    = string
  default = "aws-load-balancer-controller"
}
variable "external_dns_namespace" {
  type    = string
  default = "external-dns"
}
variable "external_dns_sa" {
  type    = string
  default = "external-dns"
}
variable "hosted_zone_arn" {
  type        = string
  description = "Route 53 zone ARN external-dns may change."
}
variable "tags" {
  type    = map(string)
  default = {}
}
