# FullStack Template

A template to start a new monorepo project using TurboRepo, npm, React, Vite, TypeScript, Tailwind, React Router. Then on the backend, Node, Express, tRPC, and database is left out of the tech stack, just choose your own.

The core project currently exports a tRPC router, however it can be changed to simply export functions or classes that perform the business logic as a service layer. This core project can be imported into other node.js project. In this case, it is mainly used in the API app, which is a very basic Express API wrapper that exposes a tRPC server. However, it can also be used to create a GraphQL API, a WebSocket API, or REST API. It can also be imported into worker projects, scripts, or CLI or any type of Node project. You could choose to keep the core project just a service layer without coupling it with the tRPC layer, however I decided to keep things simple and made core export a tRPC router.

If you choose to use multiple clients, you can create your own component library and import it into multiple web apps. However, I did not add a components project since not all projects need them.

## Variants

Obviously every project is different so you might not need the exact template provided. Instead of trying to provide the perfect template you build your own from the available options below. Each of the options below is a branch off main with commits that add a specific piece to the project. You can simply rebase each of the branches into main to build your stack.

If you don't want to manage infrastructure and don't mind being vendor locked-in choose this. Perfect for personal projects or for building fast and you dont mind paying a premium when you need to scale:

- Lambda API runtime -> DynamoDB -> SQS + Lambda worker -> S3 storage -> AWS Cognito -> AWS Secret Manager

If you want to build something that can scale but without being vendor locked-in and want to start small and on a budget go for:

- Docker Node.js API runtime -> Postgres (supabase) -> Sidequest (Postgres) worker -> S3 storage -> Railway infrastructure -> keycloak auth -> OpenBao

### APIs:

- tRPC (default)
- Apollo Server

### API Runtimes:

- Docker Node.js
- Lambda

### Databases:

- SQLite
- Postgres
- DynamoDB
- MongoDB
- Redis

### Workers:

- Sidequest
- SQS + Lambda
- SQS + Docker Node.js
- BullMQ + Docker Node.js

### Storage:

- S3
- Local files

### Infrastructure:

- Railway
- ECS

### Auth:

- Keycloak
- AWS Cognito
- Auth0

### Secret management:

- OpenBao
- AWS Secret Manager
- .env

## Getting started

```sh
npm run build:watch --workspace=@repo/utils
npm run build:watch --workspace=@repo/core
npm run build:watch --workspace=@repo/api
npm run dev --workspace=@repo/api
npm run dev --workspace=@repo/web
```

## Database (Postgres + Drizzle)

`packages/core` stores data in Postgres through [Drizzle](https://orm.drizzle.team) and the `postgres` (postgres.js) driver. The tables are defined in `packages/core/src/storage/postgresSchema.ts`, and `drizzle-kit` generates the SQL migrations in `packages/core/drizzle/` from it. The app reads one variable, `DATABASE_URL`.

Running it locally:

```sh
docker compose up -d --wait                       # Postgres 18 on :5432
cp packages/core/.env.example packages/core/.env
cp apps/api/.env.example apps/api/.env
npm run db:setup                                  # applies pending migrations (safe to re-run)
```

After changing the schema, generate a migration and commit it:

```sh
npm run db:generate --workspace=@repo/core -- --name <what_changed>
```

Tests don't need a database. Service tests use the in-memory repositories (`createInMemoryStorage`), and the Postgres repository tests run against [PGlite](https://pglite.dev), an in-memory Postgres compiled to WASM, with the real migrations applied.

### Deploying to Supabase

`packages/core/infra/supabase` is a Terraform config that creates a Supabase project with a generated database password and SSL enforced. It outputs the `DATABASE_URL` of the project's transaction pooler.

You need to install terraform:

```sh
brew tap hashicorp/tap
brew install hashicorp/tap/terraform
```

```sh
cd packages/core/infra/supabase
export SUPABASE_ACCESS_TOKEN=...                  # https://supabase.com/dashboard/account/tokens
cp terraform.tfvars.example terraform.tfvars      # then set organization_id from supbase
terraform init
terraform apply
DATABASE_URL="$(terraform output -raw database_url)" npm run db:setup
```

The state holds the database password, so keep it in a private remote backend for anything shared.
