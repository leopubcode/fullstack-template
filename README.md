# FullStack Template

A template to start a new monorepo project using TurboRepo, npm, React, Vite, TypeScript, Tailwind, React Router. Then on the backend, Node, Express, tRPC, and database is left out of the tech stack, just choose your own.

The core project currently exports a tRPC router, however it can be changed to simply export functions or classes that perform the business logic as a service layer. This core project can be imported into other node.js project. In this case, it is mainly used in the API app, which is a very basic Express API wrapper that exposes a tRPC server. However, it can also be used to create a GraphQL API, a WebSocket API, or REST API. It can also be imported into worker projects, scripts, or CLI or any type of Node project. You could choose to keep the core project just a service layer without coupling it with the tRPC layer, however I decided to keep things simple and made core export a tRPC router.

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
npm run build:watch --workspace=@repo/api
npm run dev --workspace=@repo/api
npm run dev --workspace=@repo/web
```

## Worker (SQS + Lambda)

`apps/worker` runs jobs from an SQS queue on Lambda. A job with a `runAt` becomes a one-time EventBridge Scheduler schedule that sends it to the queue when due. The infrastructure is a CDK stack that deploys to LocalStack (`stage=local`) or AWS (`stage=aws`).

Running it locally:

```sh
docker compose up -d                                     # LocalStack on :4566
cp packages/core/.env.example packages/core/.env
npm run db:setup                                         # creates the DynamoDB tables (safe to re-run)
npm run cdk:bootstrap:local --workspace=@repo/worker     # once per LocalStack volume
npm run cdk:deploy:local --workspace=@repo/worker        # builds, deploys, writes apps/worker/cdk-outputs.json
cp apps/worker/.env.example apps/worker/.env             # then fill in JOB_SCHEDULE_GROUP_NAME
npm run local-scheduler --workspace=@repo/worker
```

LocalStack stores schedules but never fires them, so `local-scheduler` polls the schedule group and sends each due job to the queue itself.

Anything that adds jobs needs `JOB_QUEUE_ARN`, `JOB_QUEUE_URL`, `JOB_SCHEDULE_GROUP_NAME` and `JOB_SCHEDULER_ROLE_ARN`, all of which are stack outputs in `cdk-outputs.json`. The CDK stack sets them for the worker. The API reads them from `apps/api/.env` (copy `apps/api/.env.example`) and won't start without them.

`docker-compose.yml` pins `localstack/localstack:4.14.0`. Later images require a `LOCALSTACK_AUTH_TOKEN` in the container's environment.
