terraform {
  required_version = ">= 1.6"

  required_providers {
    supabase = {
      source  = "supabase/supabase"
      version = "~> 1.11"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }
}

# Reads SUPABASE_ACCESS_TOKEN from the environment
# (https://supabase.com/dashboard/account/tokens).
provider "supabase" {}
