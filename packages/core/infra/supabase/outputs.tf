output "project_ref" {
  description = "The Supabase project reference."
  value       = supabase_project.this.id
}

output "database_url" {
  description = "DATABASE_URL for the app and `npm run db:setup`: the transaction pooler, with the password filled in."
  sensitive   = true
  value = "${replace(
    data.supabase_pooler.this.url["transaction"],
    "[YOUR-PASSWORD]",
    urlencode(random_password.database.result),
  )}?sslmode=require"
}
