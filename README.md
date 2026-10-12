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
npm run build:watch --workspace=@repo/worker
npm run dev --workspace=@repo/api
npm run dev --workspace=@repo/worker
npm run dev --workspace=@repo/web
```

## Database (Postgres + Drizzle)

`packages/core` stores data in Postgres through [Drizzle](https://orm.drizzle.team) and the `postgres` (postgres.js) driver. The tables are defined in `packages/core/src/storage/postgresSchema.ts`, and `drizzle-kit` generates the SQL migrations in `packages/core/drizzle/` from it. The app reads one variable, `DATABASE_URL`.

Running it locally:

```sh
docker compose up -d --wait                       # Postgres 18 on :5432, Keycloak on :8080 (see "Auth (Keycloak)"), LocalStack on :4566 (see "Files (S3)")
cp packages/core/.env.example packages/core/.env
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
npm run db:setup                                  # applies pending migrations, Drizzle's and Sidequest's (safe to re-run)
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

## Files (S3)

Services reach file storage through the `FileProvider` interface (`packages/core/src/domain/files/fileProvider.ts`). `S3FileClient` implements it by handing out presigned PUT URLs, so the browser uploads straight to the bucket; tests use `InMemoryFileClient`. Every app reads the bucket's name as `FILES_BUCKET_NAME`, and the AWS SDK's standard env (`AWS_REGION`, credentials, `AWS_ENDPOINT_URL`).

`packages/core/infra/files` is a CDK stack, `Files`, with only the bucket. It deploys to LocalStack (`stage=local`) or AWS (`stage=aws`). The bucket's CORS allows PUT from `allowedOrigins` (default `http://localhost:5173`, override with `--context allowedOrigins='[...]'`).

Running it locally:

```sh
docker compose up -d --wait                                   # LocalStack on :4566, next to Postgres
npm run cdk:bootstrap:local --workspace=@repo/core            # once per LocalStack volume
npm run cdk:deploy:local --workspace=@repo/core               # writes packages/core/infra/files/cdk-outputs.json
```

Then set `FILES_BUCKET_NAME` in `apps/api/.env` and `apps/worker/.env` to the `FilesBucketName` output. `cdklocal` needs no AWS credentials of your own.

To try it, open the web app's Upload page. It calls the `createImageUpload` mutation (`FilesService`), which returns a fresh `images/<uuid>` key and its presigned URL, then PUTs the image straight to the bucket. Below the form, `listImages` lists every uploaded image, newest first, each shown through a presigned GET URL.

On LocalStack, presigned URLs must be signed for `s3.localhost.localstack.cloud`: LocalStack doesn't route the `<bucket>.localhost` host the SDK would sign for with only `AWS_ENDPOINT_URL`. The `.env.example` files set `AWS_ENDPOINT_URL_S3` for that. That host resolves to `127.0.0.1` through public DNS, so a router with DNS-rebinding protection may block it.

To deploy to AWS, run `npm run cdk:deploy --workspace=@repo/core` with your AWS credentials. The API doesn't run on AWS, so the stack can't grant it access itself: attach the `FilesAccessPolicyArn` output to the IAM user or role whose credentials the API runs with. It lets the API list the bucket and sign upload and download URLs.

`docker-compose.yml` pins `localstack/localstack:4.14.0`. Later images require a `LOCALSTACK_AUTH_TOKEN` in the container's environment.

Persistence is a LocalStack Pro feature, so the community image starts empty every time the container restarts. Run `cdk:bootstrap:local` and `cdk:deploy:local` again after a restart, and update `FILES_BUCKET_NAME`, as the bucket gets a new name.

## Worker (Sidequest + Node.js)

`apps/worker` is a long-running Node.js process, deployed like `apps/api`, that runs background jobs with [Sidequest](https://docs.sidequestjs.com). Sidequest keeps its jobs in the same Postgres, in its own `sidequest_*` tables. `npm run db:setup` migrates them, and so does the worker each time it starts.

- Services add jobs through the `JobQueue` interface (`packages/core/src/domain/jobs/jobQueue.ts`). On Postgres, `SidequestJobQueueClient` stores each one as a `RunJob` whose argument is the job's JSON body. A `runAt` sets when the job becomes available. A `key` deduplicates the same job while it is still waiting or running.
- The worker polls for due jobs and runs each one in its own process. `src/sidequest.jobs.ts` builds the services and exports the `RunJob` that hands the body to `handleJob` in `packages/core/src/transport/jobs.ts`.
- A job whose handler throws is retried with exponential backoff, and marked `failed` after 5 attempts. A body that doesn't parse is marked `failed` straight away.
- On SIGINT or SIGTERM, the worker stops claiming jobs, waits for the running ones, and exits.

The worker reads `DATABASE_URL`, plus `SIDEQUEST_DASHBOARD_PORT` if you want Sidequest's dashboard (http://localhost:8678 with `.env.example`). The dashboard has no auth, so leave that variable unset when deployed.

To try the whole path, call the `submitTestJob` mutation on the API. It adds a `Testing` job due a day later, so change `runAt` in `TestService` to see it run sooner.

## Auth (Keycloak)

Users sign up with an email and password, verify the email by following a link, then sign in for JWTs. The web app keeps the tokens in `localStorage` and sends the access token as `Authorization: Bearer <token>`. The web app never talks to Keycloak itself: the API signs users up and in on its behalf.

Keycloak is one implementation of core's `IdentityProvider` contract (`packages/core/src/domain/identity/identityProvider.ts`):

- **Client**: `KeycloakIdentityProviderClient` is the only code that talks to Keycloak. It signs users in with the OAuth password grant, and creates accounts and sends verification emails through the Admin REST API as the client's service account. It maps Keycloak's answers to the domain errors in `domain/identity/errors.ts`, and verifies access tokens against the realm's JWKS with [`jose`](https://github.com/panva/jose). Tests use `InMemoryIdentityProviderClient`.
- **Service**: `AuthService` orchestrates the identity provider and `UsersService`. A user's id is their Keycloak user id (the token's `sub`), and the user record, with its display name, is created in Postgres at sign-up.
- **Transport**: the `auth` router has `signUp`, `resendVerification`, `signIn`, `refresh`, `signOut` and `me`. `protectedProcedure` (in `src/trpc.ts`) resolves the caller to `ctx.user`, or answers `UNAUTHORIZED`. Domain errors map to tRPC codes in one place: `CONFLICT` (account exists), `PRECONDITION_FAILED` (email not verified), `BAD_REQUEST` (password policy), `UNAUTHORIZED` (credentials or token).
- **Web**: `useAuth()` (from `apps/web/src/auth`) returns `{ status, user, signUp, resendVerification, signIn, signOut }`. `RequireAuth` guards a route. The tRPC client refreshes the access token once on an `UNAUTHORIZED` and retries, and signs out if the refresh token is rejected too.
- **Sign-out** ends the Keycloak session, so its refresh tokens stop working. Access tokens already issued stay valid until they expire (5 minutes), because they're verified locally.

Locally, `docker compose up` runs Keycloak 26 in dev mode on http://localhost:8080 (admin console: `admin` / `admin`), with its own `keycloak` database in the compose Postgres, created by the one-shot `keycloak-db` service. On first start it imports the `app` realm from `packages/core/infra/keycloak/app-realm.json`:

- a confidential `api` client with password sign-in and a service account allowed to manage users, whose dev-only secret is in `apps/api/.env.example`;
- a password policy of at least 8 characters, and required email verification;
- a user profile with only a username and an email, so accounts need no first or last name before they can sign in;
- SMTP through [Mailpit](https://mailpit.axllent.org), which catches every email at http://localhost:8025.

The import is skipped once the realm exists. To re-import after editing the file, delete the realm in the admin console and restart Keycloak (`docker compose restart keycloak`).

The verification link opens Keycloak's "Account updated" page, whose "Back to Application" link goes to `KEYCLOAK_VERIFY_EMAIL_REDIRECT_URI` (`/signin?verified=1` on the web app). That URI must match one of the `api` client's valid redirect URIs.

Tokens are only accepted from the issuer `KEYCLOAK_URL/realms/KEYCLOAK_REALM`. In dev mode, Keycloak names itself after the host each request came in on, so the API must reach it at the same URL it is configured with (`http://localhost:8080` when the API runs on the host). In production, run `start` instead of `start-dev`, set `KC_HOSTNAME` to Keycloak's public URL, configure a real SMTP server, and replace the client secret.
