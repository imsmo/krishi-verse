# infra/terraform/envs/prod/backend.tf · remote state (S3 + DynamoDB lock)
#
# Bootstrap the state bucket + lock table ONCE before `terraform init` (see the apply runbook, step 1).
# Replace <ACCOUNT_ID_OR_ORG> with your unique suffix (S3 bucket names are globally unique).

terraform {
  backend "s3" {
    bucket         = "krishiverse-tfstate-<ACCOUNT_ID_OR_ORG>"
    key            = "prod/foundation.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "krishiverse-tflock"
    encrypt        = true
  }
}
