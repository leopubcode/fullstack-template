# Generated here rather than passed in, so it never sits in a tfvars file.
# It still lands in the Terraform state, so keep that state somewhere private.
resource "random_password" "database" {
  length  = 32
  special = false
}

resource "supabase_project" "this" {
  organization_id   = var.organization_id
  name              = var.project_name
  database_password = random_password.database.result
  region            = var.region

  lifecycle {
    # Changing the password in Terraform doesn't change it on the database.
    ignore_changes = [database_password]
  }
}

resource "supabase_settings" "this" {
  project_ref     = supabase_project.this.id
  ssl_enforcement = true
}

# Supavisor's connection strings, keyed by pool mode. The direct
# db.<ref>.supabase.co host is IPv6-only, so the app connects via the pooler.
data "supabase_pooler" "this" {
  project_ref = supabase_project.this.id

  depends_on = [supabase_settings.this]
}
