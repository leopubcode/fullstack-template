# FullStack Template

A template to start a new monorepo project using TurboRepo, npm, React, Vite, TypeScript, Tailwind, React Router. Then on the backend, Node, Express, tRPC, and database is left out of the tech stack, just choose your own.

The core project currently exports a tRPC router, however it can be changed to simply export functions or classes that perform the business logic as a service layer. This core project can be imported into other node.js project. In this case, it is mainly used in the API app, which exposes the tRPC router as a Lambda behind a Function URL. However, it can also be used to create a GraphQL API, a WebSocket API, or REST API. It can also be imported into worker projects, scripts, or CLI or any type of Node project. You could choose to keep the core project just a service layer without coupling it with the tRPC layer, however I decided to keep things simple and made core export a tRPC router.

If you choose to use multiple clients, you can create your own component library and import it into multiple web apps. However, I did not add a components project since not all projects need them.

## Variants

Obviously every project is different so you might not need the exact template provided. Instead of trying to provide the perfect template you build your own from the available options below. Each of the options below is a branch off main with commits that add a specific piece to the project. You can simply rebase each of the branches into main to build your stack.

If you don't want to manage infrastructure and don't mind being vendor locked-in choose this. Perfect for personal projects or for building fast and you dont mind paying a premium when you need to scale:

- Lambda API runtime -> DynamoDB -> SQS + Lambda worker -> S3 storage -> AWS Cognito -> AWS Secret Manager

If you want to build something that can scale but without being vendor locked-in and want to start small and on a budget go for:

- Docker Node.js API runtime -> Postgres (supabase) -> Sidequest (Postgres) worker -> S3 storage -> ECS infrastructure -> keycloak auth -> OpenBao

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

- Fly.io
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
npm run dev --workspace=@repo/api                         # local server on :4000, see "API (Lambda)"
npm run dev --workspace=@repo/web
```

## Infrastructure

Every stack is CDK and deploys to LocalStack (`stage=local`) or AWS (`stage=aws`). The infra is split three ways:

- **Resources**: `packages/core/infra` holds the `Resources` stack: the Users table, the job queue and scheduler, the files bucket, and the Cognito user pool. It writes each resource's name or ARN to an SSM parameter under `/resources/` and knows nothing about who uses them.
- **Compute**: each app defines only its own Lambda runtime (`apps/api/infra/ApiFunction.ts`, `apps/worker/infra/JobWorker.ts`).
- **Access**: each app stack looks the resources up with `SharedResources` and gives its Lambda what it needs with one `ResourceAccess` (both from `@repo/core/infra`). Each access, e.g. `resources.files.upload`, sets the env vars core's config reads (`ENV` in `packages/core/src/config.ts`) and the IAM rights that use needs.

Deploy the `Resources` stack first; the `Jobs` and `Api` stacks then deploy in either order. Locally:

```sh
docker compose up -d                                     # LocalStack on :4566, cognito-local on :9229
npm run setup:cognito-local --workspace=@repo/core       # once per .cognito/db, see "Auth (Cognito)"
npm run cdk:bootstrap:local --workspace=@repo/core       # once per LocalStack volume
npm run cdk:deploy:local --workspace=@repo/core          # writes packages/core/cdk-outputs.json
```

`packages/core/cdk-outputs.json` holds the values the local env files need (`USERS_TABLE_NAME`, the `JOB_*` values, `FILES_BUCKET_NAME`).

A LocalStack volume used before this layout still has the old `Users` table (from the removed `db:setup`) and the resources the `Jobs` stack used to own. Recreate the volume (`docker compose down -v`) to start clean. On AWS, the old `Jobs` stack's resources are retained and orphaned rather than migrated.

## Worker (SQS + Lambda)

`apps/worker` runs jobs from an SQS queue on Lambda. A job with a `runAt` becomes a one-time EventBridge Scheduler schedule that sends it to the queue when due.

Running it locally, after deploying the `Resources` stack:

```sh
npm run cdk:deploy:local --workspace=@repo/worker        # builds and deploys the worker Lambda
cp apps/worker/.env.example apps/worker/.env             # then fill in JOB_SCHEDULE_GROUP_NAME
npm run local-scheduler --workspace=@repo/worker
```

LocalStack stores schedules but never fires them, so `local-scheduler` polls the schedule group and sends each due job to the queue itself.

The worker's batch timeout is `JOB_WORKER_MAX_TIMEOUT` from `@repo/core/infra`. The queue's visibility timeout is six times it, so a worker must not run longer.

## Files (S3)

The files bucket lives in the `Resources` stack. The API hands out presigned PUT URLs so the browser uploads straight to the bucket, and only the API is granted write access (`resources.files.upload`). The worker gets only the bucket's name (`resources.files.reference`), because core's `loadConfig` requires it. The bucket's CORS allows PUT from `allowedOrigins` (default `http://localhost:5173`; override with `--context allowedOrigins='[...]'` on core's deploy).

On LocalStack, presigned URLs must be signed for `s3.localhost.localstack.cloud`: LocalStack doesn't route the `<bucket>.localhost` host the SDK would sign for with only `AWS_ENDPOINT_URL`. `apps/api/.env.example` sets `AWS_ENDPOINT_URL_S3` for the local server, and the API stack sets it on the Lambda when `stage=local`. That host resolves to `127.0.0.1` through public DNS, so a router with DNS-rebinding protection may block it.

`docker-compose.yml` pins `localstack/localstack:4.14.0`. Later images require a `LOCALSTACK_AUTH_TOKEN` in the container's environment.

## API (Lambda)

`apps/api` serves the tRPC router from a Lambda behind a public Function URL (`src/lambda.ts`). Procedures are served from the URL's root, e.g. `POST <ApiUrl>/submitTestJob`, so the web app's `VITE_API_URL` is the bare URL with no `/trpc` suffix.

For day-to-day development, `npm run dev --workspace=@repo/api` serves the same handler on `http://localhost:4000` by turning each HTTP request into a Function URL event. It reads `apps/api/.env` (copy `apps/api/.env.example` and fill it in from `packages/core/cdk-outputs.json`) and talks to LocalStack.

To deploy the Lambda, after deploying the `Resources` stack:

```sh
npm run cdk:deploy:local --workspace=@repo/api           # writes apps/api/cdk-outputs.json
cp apps/web/.env.example apps/web/.env                   # then set VITE_API_URL to the ApiUrl output
```

The Function URL itself is public; the app authenticates callers from their bearer token (see "Auth (Cognito)"). CORS allows `http://localhost:5173` by default; pass `--context allowedOrigins='["https://app.example.com"]'` to change it.

## Auth (Cognito)

Users sign up with an email and password, confirm the email with a code, then sign in for JWTs. The web app keeps the tokens in `localStorage` and sends the access token as `Authorization: Bearer <token>`.

Cognito is just one implementation of core's `IdentityProvider` contract (`packages/core/src/domain/identity/identityProvider.ts`):

- **Client**: `CognitoIdentityProviderClient` is the only file that imports the Cognito SDK, and it maps Cognito's errors to the domain errors in `domain/identity/errors.ts`. It verifies access tokens against the issuer's JWKS with [`jose`](https://github.com/panva/jose), so it works with any OIDC issuer. Swapping in Keycloak or Auth0 means writing another Client; services and transports don't change.
- **Service**: `AuthService` orchestrates the identity provider and `UsersService`. A user's id is their identity's `sub`, and the user record is created at sign-up.
- **Transport**: the `auth` router has `signUp`, `confirmSignUp`, `resendConfirmationCode`, `signIn`, `refresh`, `signOut` and `me`. `protectedProcedure` (in `src/trpc.ts`) resolves the caller to `ctx.user`, or answers `UNAUTHORIZED`. Domain errors map to tRPC codes in one place: `CONFLICT` (account exists), `PRECONDITION_FAILED` (not confirmed), `BAD_REQUEST` (code or password policy), `UNAUTHORIZED` (credentials or token).
- **Web**: `useAuth()` (from `apps/web/src/auth`) returns `{ status, user, signUp, confirmSignUp, resendConfirmationCode, signIn, signOut }`. `RequireAuth` guards a route. The tRPC client refreshes the access token once on an `UNAUTHORIZED` and retries, and signs out if the refresh token is rejected too.
- **Sign-out** revokes the session's refresh token (`RevokeToken`). Access tokens already issued stay valid until they expire (an hour by default), because they're verified locally.

On AWS, the `Resources` stack creates the user pool and a public client (no secret, password and refresh flows), and the API gets the pool's ids through `resources.identity.authenticate`. That access is env-only: these Cognito APIs need no IAM.

Locally, Cognito runs in [cognito-local](https://github.com/jagregory/cognito-local) (in `docker-compose.yml`), because LocalStack's community image has no Cognito. `npm run setup:cognito-local --workspace=@repo/core` creates the pool and client. It writes their ids to `packages/core/cdk.context.json`, where the local `Resources` stack publishes them instead of creating a pool. It also prints the `COGNITO_*` lines for `apps/api/.env`. cognito-local doesn't send email: read the confirmation code from `docker compose logs cognito-local`. `.cognito/config.json` pins the tokens' issuer to `http://localhost:9229`, which the local API server on the host can reach. A Lambda deployed to LocalStack can't reach that issuer, so run the API locally with `npm run dev` when working on auth.
