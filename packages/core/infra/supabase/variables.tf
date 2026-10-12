variable "organization_id" {
  description = "Supabase organization slug, from the dashboard URL or organization settings."
  type        = string
}

variable "project_name" {
  description = "Name of the Supabase project."
  type        = string
}

variable "region" {
  description = "Region to host the project in, e.g. us-east-1."
  type        = string
  default     = "us-east-1"
}
