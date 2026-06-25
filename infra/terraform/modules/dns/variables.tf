# infra/terraform/modules/dns/variables.tf
variable "root_domain" {
  type        = string
  description = "Apex domain, e.g. krishiverse.ai"
}
variable "tags" {
  type    = map(string)
  default = {}
}
