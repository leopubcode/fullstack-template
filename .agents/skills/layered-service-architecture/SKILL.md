---
name: layered-service-architecture
description: "Enforces a four-layer backend architecture — Repository (or its Client variant for external providers), Model, Service, Transport — for any feature that touches persistence or integrates with a third-party API/SDK, regardless of storage technology (DynamoDB, Postgres, Mongo, in-memory, etc.), external provider (Stripe, S3, SendGrid, etc.), or transport (tRPC, GraphQL, REST, WebSocket). Use this whenever adding a new domain/entity to a backend package, integrating a new third-party provider or API, wiring up persistence for existing business logic, deciding where a piece of backend logic belongs (router vs service vs model vs repository vs client), adding background jobs, a job queue, a scheduler, or a worker (SQS, EventBridge, Lambda, pollers), reviewing or reorganizing backend code that mixes concerns (a router touching a database client directly, a repository containing business rules, a service calling a provider's SDK directly instead of through a Client), or when the user asks about repository pattern, service layer, persistence layer, third-party integrations, or backend architecture — even if they don't name these layers explicitly."
---

# Layered Service Architecture

Every backend feature that touches persistence, or an external provider, is built from four layers, each with one job. The value of the split isn't ceremony — it's that each layer can change for its own reason without disturbing the others: swap Postgres for DynamoDB, or Stripe for another payment processor, and only the Repository Layer moves; swap tRPC for GraphQL and only the Transport Layer moves; the business rules in the Model and the orchestration in the Service never notice any of it.

```
Transport  →  Service  →  Repository  →  (the actual data source)
                 ↓
               Model
```

Dependencies point one way, top to bottom. A lower layer never imports from or calls a higher one. If you find yourself reaching upward, the logic is in the wrong layer.

## The Four Layers

### 1. Repository Layer

**Role:** the only code that talks to the data source. It abstracts away the low-level access patterns (SQL, DynamoDB `PutCommand`, Mongo driver calls, whatever) behind a plain interface such as `UsersRepository` with methods like `create`, `getById`, `list`.

- Define the interface once, in the domain's own folder — not in the repository implementation's file. The Service depends on the interface, not on `DynamoUsersRepository` or `PostgresUsersRepository` directly. This is what makes the storage technology swappable and the Service testable without hitting a real database.
- A repository method returns data, not business meaning. It shouldn't decide whether a User is allowed to bid, or whether a Listing is still active — that's the Model's job.
- If two entities live in the same physical table (or the same document), they still get separate repositories if they're separate domain concepts. The repository boundary follows the domain, not the schema.

```ts
// domain/users/repository.ts — the contract, owned by the domain
export interface UsersRepository {
  create(user: User): Promise<void>;
  getById(id: string): Promise<User | undefined>;
  list(): Promise<User[]>;
}
```

```ts
// storage/UsersRepository/DynamoUsersRepository.ts — one specific implementation
export class DynamoUsersRepository implements UsersRepository {
  constructor(
    private readonly tableName: string,
    private readonly client: DynamoDBDocumentClient,
  ) {}

  async create(user: User) {
    await this.client.send(
      new PutCommand({ TableName: this.tableName, Item: user }),
    );
  }
  // ...
}
```

**Smell test:** if a repository method has an `if` statement that isn't about how to fetch/store the data (pagination, retries, marshaling), that branch is business logic and belongs in the Model or Service instead.

#### The same pattern for external providers: the Client

Not every integration is with your own data store — sometimes a Service needs to reach a third-party API or SDK instead: a payment processor, an email provider, a file store like S3. This is the identical architectural role as a Repository, just aimed outward instead of at your own database: abstract the low-level integration behind an interface the domain dictates, so the Service depends on that interface and never on the concrete SDK.

Name the implementation `<Tech><ProviderName>Client` (e.g. `StripePaymentProviderClient`, `S3FileProviderClient`), and let the domain own the interface it must satisfy, named for the provider's role rather than generically — `paymentProvider.ts` exporting a `PaymentProvider`, `fileProvider.ts` exporting a `FileProvider`. Swapping providers later (Stripe for another processor, S3 for another file store) only touches the Client implementation, exactly like swapping `DynamoUsersRepository` for `PostgresUsersRepository` only touches the Repository implementation.

```ts
// domain/payment-provider/paymentProvider.ts — the contract, owned by the domain
export interface PaymentProvider {
  charge(amount: number, cardToken: string): Promise<ChargeResult>;
}
```

```ts
// storage/PaymentProviderClient/StripePaymentProviderClient.ts — one specific implementation
export class StripePaymentProviderClient implements PaymentProvider {
  async charge(amount: number, cardToken: string) {
    const result = await stripeSdk.charges.create({
      amount,
      source: cardToken,
    });
    return { id: result.id, status: result.status };
  }
}
```

A provider interface doesn't require a Model or persisted entity behind it — see the `PaymentGatewayService` example under Service Layer, which depends on `PaymentProvider` with nothing to persist at all.

**Smell test:** if code outside the `<Tech><ProviderName>Client` file and its client instance imports the provider's SDK directly, the boundary has been bypassed — the next provider swap will miss that call site.

#### The client instance

The raw SDK client underneath a Repository or Client is plumbing, not a boundary: one shared **client instance** per SDK, in `storage/<tech>ClientInstance.ts`.

- **Configure it from the SDK's standard environment only**: `new DynamoDBClient({})`. The SDK resolves region, credentials and endpoint itself, so one `AWS_ENDPOINT_URL` points every client at an emulator, and role credentials keep their session token (a client built from an explicit key/secret drops it and fails on Lambda).
- **Inject it as a required constructor parameter.** Plain values come first; the SDK clients come last, with no default, so a Repository or Client never reaches for a module-level instance:

  ```ts
  export class AwsJobQueueClient implements JobQueue {
    constructor(
      private readonly config: AwsJobQueueConfig,
      private readonly clock: Clock,
      private readonly scheduler: SchedulerClient,
      private readonly sqs: SQSClient,
    ) {}
  }
  ```

- **Factories pass the shared instances in.** `createAwsStorage` is the only place that imports the client instances. It builds `new DynamoUsersRepository(tables.users, dynamodbDocumentClient)` and `new AwsJobQueueClient(config.jobQueue, clock, schedulerClient, sqsClient)`, taking the plain values from config loaded out of env. See _Factories and composition roots_ below.
- **Tests pass their own instances** (`new SchedulerClient({})`) and mock them with `aws-sdk-client-mock`, so each test controls exactly the client under test.

#### The same pattern for job queues

A job queue (SQS, Scheduler, RabbitMQ, BullMQ…) is a Client too, with a transport on the consuming side:

- The domain owns the job envelope and a `JobQueue` interface. Services only ever `add(job, { runAt?, key? })`.
- `storage/JobQueueClient/` holds the provider Client and an in-memory Client.
- `transport/jobs.ts` dispatches each job body to its handler.
- The worker app's runtime adapter (Lambda, a poller) only feeds bodies to that transport.

This lets the queue provider and the worker runtime be swapped independently. **When adding background jobs, a queue, a scheduler or a worker, read [JOB-QUEUES.md](JOB-QUEUES.md).**

### 2. Model

**Role:** the domain entity itself — its shape and the pure business rules that operate on it, written in plain TypeScript with no dependency on any SDK, database client, or transport framework. A Model should be understandable and testable with zero mocks.

- Model as a class, favoring **composition over inheritance**. If two Models need to share behavior, share it through a composed helper (a small object or function passed in or wrapped), not through a common base class. A base class couples every Model to a hierarchy that gets harder to bend as the domain grows; composition keeps each Model's behavior swappable independently.
- Use the project's own domain vocabulary (check `CONTEXT.md` if the project has one) for method and property names — a Model is where the domain language should be most visible in the code.
- A Model doesn't know it's being persisted. It never imports a repository, a database client, or a transport type.

```ts
// domain/users/model.ts
export class UserModel {
  constructor(private readonly data: User) {}

  hasRole(role: Role): boolean {
    return this.data.roles.includes(role);
  }

  get id() {
    return this.data.id;
  }
}
```

**Smell test:** if a Model file imports `@aws-sdk/*`, a SQL client, or `express`/`@trpc/server`, business logic has leaked out of its layer or a dependency has leaked in.

### 3. Service Layer

**Role:** the central hub for a use case. A Service is constructor-injected with whichever repositories and Models it needs, and it's the _only_ place that orchestrates them to get work done. Centralizing here means there's exactly one place to look for "how does sign-up actually work," not one implementation per transport.

- A Service can use more than one repository and more than one Model — cross-entity orchestration (a purchase request that touches both Listings and Purchase Requests) belongs here, not duplicated across routers/controllers.
- **The Service owns all conversion, transformation, and mapping of the response.** Whatever shape a Service method returns is exactly what gets handed to the Transport Layer — no reshaping happens after the Service returns.
- A Service doesn't know or care whether it's being called from tRPC, a REST controller, a cron job, or a test. It takes plain inputs and returns plain outputs.
- **A Service's name is decoupled from any entity, Model, or Repository — it's named for the use case or capability it owns, not forced to match a domain noun.** `UsersService` happens to line up with a `UsersRepository` and `UserModel` because sign-up and listing really are User operations, but that alignment is incidental, not a rule to enforce. A `PaymentGatewayService` might have no corresponding entity, Model, or Repository at all — there's nothing to persist, so it depends on a Client's provider interface (see the Client subsection under Repository Layer) instead. Don't invent a Model or Repository to satisfy a naming convention; a Service only needs the pieces the use case actually requires, and that has to be made explicit case by case rather than assumed from the name.

```ts
// services/UsersService.ts — aligns with an entity, because this use case is that entity
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  async signUp(displayName: string): Promise<User> {
    const user: User = {
      id: crypto.randomUUID(),
      displayName,
      roles: ["Customer"],
    };
    await this.repository.create(user);
    return user;
  }

  list(): Promise<User[]> {
    return this.repository.list();
  }
}
```

```ts
// services/PaymentGatewayService.ts — no corresponding entity, Model, or Repository
export class PaymentGatewayService {
  constructor(private readonly paymentProvider: PaymentProvider) {}

  charge(amount: number, cardToken: string): Promise<ChargeResult> {
    return this.paymentProvider.charge(amount, cardToken);
  }
}
```

**Smell test:** if business logic that decides _what_ to do (not just _how_ to fetch it) lives in a router/controller/resolver instead of a Service, it's in the wrong layer — and it likely means the same decision gets re-implemented the next time a second transport is added.

### 4. Transport Layer

**Role:** whatever gets a request in and a response out — a tRPC router, a GraphQL resolver, a REST controller, a WebSocket handler, or a jobs transport that dispatches queued jobs to their handlers (see [JOB-QUEUES.md](JOB-QUEUES.md)). Its job is narrow and mechanical:

1. Validate and parse the input.
2. Call the Service with that input.
3. Return exactly what the Service gave back.

The Transport Layer does **not** transform, map, or reshape the Service's response — that's the Service's job, done once, not redone per transport. This is what makes it cheap to add a second transport (e.g. a GraphQL API alongside an existing tRPC one) later: both call the same Service and both get the same shape back, with no duplicated mapping logic to keep in sync.

A transport file's name is likewise not tied to an entity — it's organized however the transport technology naturally groups things (one file per Service it exposes, one per route group, one big schema for GraphQL), not forced into a one-file-per-entity convention.

```ts
// transport/users.ts (tRPC in this example — same shape for REST/GraphQL)
export const usersRouter = router({
  signUp: publicProcedure
    .input(z.object({ displayName: z.string().trim().min(1) }))
    .mutation(({ input, ctx }) => ctx.services.users.signUp(input.displayName)),

  list: publicProcedure.query(({ ctx }) => ctx.services.users.list()),
});
```

**Smell test:** if a router/controller/resolver has an `if`, a `.map()`, or any logic beyond parsing input and calling the Service, that's Service logic that leaked upward.

## Directory & File Structure

Each layer gets its own top-level directory, not a folder per domain containing all four layers mixed together. The reason is the same one behind the whole architecture: each layer changes for a different reason, so each one should be swappable on its own without hunting through every domain's folder for the piece that needs to move.

```
src/
├── storage/                               # or repository/, persistence/, integrations/ — project's choice of name
│   ├── <tech>ClientInstance.ts            # shared SDK client/connection, passed into repositories or Clients by create<Tech>Storage
│   ├── create<Tech>Storage.ts             # factory: one Storage bundle per tech, e.g. createAwsStorage.ts, createInMemoryStorage.ts
│   ├── <Entity>Repository/                # one subdirectory per Repository contract
│   │   ├── <Tech1><Entity>Repository.ts   # e.g. DynamoUsersRepository.ts
│   │   └── <Tech2><Entity>Repository.ts   # e.g. InMemoryUsersRepository.ts, a test double for the same contract
│   └── <ProviderName>Client/              # one subdirectory per Client contract, same reasoning
│       ├── <Tech1><ProviderName>Client.ts # e.g. StripePaymentProviderClient.ts
│       └── <Tech2><ProviderName>Client.ts # e.g. a FakePaymentProviderClient.ts for tests
├── config.ts                              # env loaders: one per section, plus loadConfig
├── domain/
│   ├── storage.ts                         # the Storage bundle of Repository and Client contracts
│   └── <entity-or-capability>/
│       ├── types.ts                       # the entity's plain data shape (when there's a persisted entity)
│       ├── repository.ts                  # the <Entity>Repository interface — for a data source
│       ├── <providerName>.ts              # the <ProviderName> interface — for an external provider, e.g. paymentProvider.ts
│       └── model.ts                       # <Entity>Model — business logic (when there's a persisted entity)
├── services/
│   ├── createServices.ts                  # factory: the service graph, over any Storage
│   └── <Name>Service.ts                   # named for the use case/capability it owns
└── transport/
    └── <name>.ts                          # router.ts / resolver.ts / controller.ts — transport-specific
```

- **`storage/`** holds every boundary implementation — Repositories talking to your own data store _and_ Clients talking to an external provider — since both play the same role: the only files allowed to import the concrete SDK. Each Repository or Client gets its own subdirectory, named for the contract with the tech name stripped out (`UsersRepository/`, `PaymentProviderClient/`); every tech-specific implementation of that same contract lives inside it. This matters as soon as a contract has more than one implementation — most commonly because a test double (`InMemoryUsersRepository`) lives alongside the real one (`DynamoUsersRepository`), but equally for a genuine multi-provider swap. Without the subdirectory, `storage/` flattens into one undifferentiated pile where `DynamoUsersRepository.ts` and `InMemoryUsersRepository.ts` sit as two unrelated-looking files instead of two implementations of one contract; with it, the top level of `storage/` answers "what Repositories and Clients does this project have" at a glance, and you only step into a subdirectory when you need to know which technologies implement a specific one. Only two kinds of file stay flat at the top of `storage/`, because neither is a boundary implementation. The shared SDK client/connection plumbing (`<tech>ClientInstance.ts`) is internal plumbing that the storage factory passes into several Repositories or Clients. The storage factories (`create<Tech>Storage.ts`) assemble one tech's implementations into a Storage. Swap DynamoDB for Postgres, or Stripe for another processor, and only the relevant subdirectory changes.
- **`domain/<entity-or-capability>/`** holds what should almost never change: the shape of what's being modeled (if anything is persisted), the contract a Repository or Client must fulfill, and the pure business rules in its Model. Nothing here depends on a storage technology, an external provider's SDK, or a transport. A folder here doesn't require all of `types.ts`/`model.ts` — a pure external-provider integration may have nothing but the provider interface.
- **`services/`** sits above `domain/` and `storage/`, wiring specific repositories and Models together for a use case. It's its own top-level directory rather than nested inside one domain's folder because a Service is often not scoped to a single entity — it can span several (a purchase request Service reaching into both Listings and Purchase Requests repositories), or none at all (a Service with no persistence needs).
- **`transport/`** holds everything specific to the chosen transport — swap tRPC for GraphQL and only this directory changes.

`<Name>` and `<entity>` in the tree above are placeholders for _whatever that layer's own naming boundary turns out to be_ — they don't have to line up with each other. `services/UsersService.ts` naming itself after `domain/users/` is a coincidence of that particular use case matching that particular entity one-to-one, not a convention the directory structure requires. A `services/PaymentGatewayService.ts` with no `domain/payment-gateway/` folder at all is just as valid — build the domain folder, the repository, and the model only when there's an entity that actually needs them.

A domain with no persistence yet just omits `repository.ts` and the matching subdirectory under `storage/` — don't create either ahead of the code that needs it. A Repository or Client with only one implementation so far still gets its own subdirectory (`UsersRepository/DynamoUsersRepository.ts`, not `storage/DynamoUsersRepository.ts`) — the subdirectory is about what the contract is, not how many implementations currently exist, so adding the second implementation later (most often a test double) never requires a rename or a move.

## Factories and composition roots

A **composition root** is an app's entry file (the API server, the worker's Lambda handler). It chooses which Storage to build and which runtime to adapt to, and nothing else. It never builds a Repository, Client or Service with `new`. Instead it calls factories, which are plain `create*` functions in core:

```ts
const config = loadConfig(process.env);
const clock = createSystemClock();
const services = createServices(createAwsStorage(config, clock), {
  clock,
  purchaseRequestExpiryPeriodMs: config.purchaseRequestExpiryPeriodMs,
});
```

- **`config.ts` loads env.** It has one loader per section (`loadTablesConfig`, `loadJobQueueConfig`) and `loadConfig`, which combines them. Each is a pure function of an `env` object, and each throws on a missing variable, so a root fails at startup. A tool that needs only one section loads only that section.
- **`domain/storage.ts` defines `Storage`**, the bundle of every Repository and Client contract the services need.
- **`storage/create<Tech>Storage.ts` builds one Storage per tech**: `createAwsStorage(config, clock)` for the real thing, `createInMemoryStorage(clock)` for tests. It's the only place that knows how to construct each implementation, for example an in-memory Repository sharing its siblings. To override one piece, spread it: `{ ...createInMemoryStorage(clock), jobQueue }`.
- **`services/createServices.ts` wires the graph.** `createServices(storage, options)` is the only place that knows which Service needs which Repositories and Clients. Giving a Service a Repository or Client that Storage already holds changes only this file. A new contract also changes `Storage` and each `create<Tech>Storage`.
- **Core exports the factories, not the classes.** The concrete Repository, Client and Service classes stay out of the package's public index, so no root can hand-wire the graph. `createInMemoryStorage` is reached through the test helpers.

Use plain functions, not a DI container or an Abstract Factory. Each root knows at build time which Storage it wants, and TypeScript checks that the wiring is complete. A container hides "who builds what" behind decorators or runtime lookup. An Abstract Factory interface pays off only when something picks the implementation at runtime.

## Decision Checklist

When you're not sure where a piece of logic belongs, ask in this order:

1. **Does it decide _how_ to reach the data source, or an external provider's API/SDK** (a query, a marshaling detail, a retry)? → Repository Layer (Repository for a data source, Client for a provider — same rule either way).
2. **Does it describe what the entity _is_ or a rule about it in isolation** (is this User allowed to hold this Role)? → Model.
3. **Does it orchestrate one or more repositories/Models to get a use case done, or shape the final response**? → Service Layer.
4. **Is it purely about getting a request in the door and a response out**? → Transport Layer, and only that.

If a change to "how we call this from GraphQL instead of tRPC" would force you to touch this code, it's in the wrong layer — only the Transport Layer should care.

## Failure Modes

- **A router/controller with business logic** degrades quietly: it works until a second transport is added, then the same decision has to be re-implemented and the two silently drift apart.
- **A repository (or Client) with business logic** is a correctness bug waiting for a technology or provider swap: the day someone changes `DynamoUsersRepository` for `PostgresUsersRepository`, or `StripePaymentProviderClient` for a different processor, the business rule goes missing because nobody thought to look for it there.
- **A Model with a database import** is the tell that a "pure" business rule was never actually pure — tests for it now need a real or mocked data source for no reason.

Choose the layer whose failure mode you'd rather debug.
