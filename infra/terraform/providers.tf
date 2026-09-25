# providers.tf
# -----------------------------------------------------------------------------
# AWS provider configuration.
#
# A single default provider in var.region handles MOST resources. Note that
# CloudFront ACM certificates MUST live in us-east-1 — see modules/cdn. If
# var.region is ever set to something other than us-east-1, you will need a
# second aliased provider (provider "aws" { alias = "us_east_1" ... }) and pass
# it into the cdn module. For this skeleton we assume region == us-east-1, which
# keeps the wiring simple.
# -----------------------------------------------------------------------------

provider "aws" {
  region = var.region

  # default_tags are merged onto every taggable resource created by this
  # provider, so we don't have to repeat them on each resource.
  default_tags {
    tags = {
      Project     = "ob-cms"
      ManagedBy   = "terraform"
      Environment = var.environment
    }
  }
}
