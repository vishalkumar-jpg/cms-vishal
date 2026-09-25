# versions.tf
# -----------------------------------------------------------------------------
# Terraform & provider version constraints for the OB-CMS platform.
#
# STATUS: SKELETON / NOT YET PROVISIONED. Nothing here has been `terraform apply`-ed.
# This file pins the toolchain so that the rest of the HCL validates coherently.
# -----------------------------------------------------------------------------

terraform {
  # Terraform 0.13+ is required for the new module `for_each` / nested provider
  # syntax used throughout. We pin >= 1.3 to be safe with optional() in vars.
  required_version = ">= 0.13"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0" # AWS provider v5.x syntax (used everywhere below).
    }

    # `random` is used only to generate unique suffixes for globally-unique
    # resource names (e.g. S3 buckets). Optional but convenient.
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # ---------------------------------------------------------------------------
  # REMOTE STATE BACKEND (STUBBED / COMMENTED OUT)
  # ---------------------------------------------------------------------------
  # In a real deployment, state should live in an encrypted S3 bucket with a
  # DynamoDB table for state locking. We intentionally leave this commented out
  # because:
  #   1. The bucket + table must be created out-of-band (chicken/egg problem).
  #   2. This skeleton uses the default LOCAL backend so `terraform init`
  #      succeeds without any cloud credentials.
  #
  # To enable: create the bucket + lock table, then uncomment and `terraform init
  # -migrate-state`.
  #
  # backend "s3" {
  #   bucket         = "ob-cms-terraform-state"      # STUB: must pre-exist
  #   key            = "platform/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "ob-cms-terraform-locks"      # STUB: must pre-exist
  #   encrypt        = true
  # }
}
