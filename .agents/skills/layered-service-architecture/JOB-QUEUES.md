# Job queues and job handlers

A job queue spans two sides: services that **add** jobs, and a worker that **runs** them. Each side gets a seam, so either technology can be swapped on its own:

- **Queue provider** (SQS + EventBridge Scheduler, RabbitMQ, BullMQ, Cloud Tasks…): only the Client under `storage/` changes.
- **Worker runtime** (Lambda, a long-running Node.js poller, a container job…): only the runtime adapter in the worker app changes.

```text
Service ──add(job)──▶ JobQueue (domain interface)
                         ▲ implemented by
                  storage/JobQueueClient/<Tech>JobQueueClient ──▶ provider
                                                                     │ delivers body
worker app runtime adapter (Lambda handler / poll loop) ◀────────────┘
   └─▶ transport/jobs.ts handleJob(body) ──▶ handler table ──▶ Service
```

## The pieces

1. **Domain owns the contract.** `domain/jobs/` holds:
   - the **job envelope**: a plain-JSON discriminated union on `type`, defined once with a schema (e.g. zod) and shared by producer and consumer
   - the **`JobQueue` interface** (`jobQueue.ts`), the only thing a service sees: `add(job, { runAt?, key? })`

   The interface names _intent_ ("run no earlier than", "idempotency key") and never a provider concept (schedule, message, delay seconds, FIFO group).

2. **Client implements it.** `storage/JobQueueClient/<Tech>JobQueueClient.ts` follows the Repository/Client pattern: with its client instances (see _The client instance_ in SKILL.md), it is the only code that imports the provider's SDK, and it owns every provider mapping. For example, it decides that `runAt` becomes a one-time schedule and its absence a direct send, that `key` becomes an idempotent schedule name, and that a duplicate-name error counts as success.
3. **In-memory Client for tests.** `InMemoryJobQueueClient` sits beside it.
   - It stores jobs as the serialized JSON body a real queue would carry, so a non-serializable job fails in tests too.
   - A `runDueJobs(run)` helper runs each job whose `runAt` has passed on the test clock, once, by handing its body to the jobs transport.
   - It honours `key` the way the real Client does, so tests see the same deduplication as production.
4. **Jobs transport dispatches.** `transport/jobs.ts` is the worker-side counterpart of the request router. `handleJob(body, context, handlers = jobHandlers)` does three things:
   - parses the body against the envelope schema
   - looks up the handler for `job.type` in a typed handler table (`{ [T in JobType]: handler }`, so a new job type fails to compile until it has a handler)
   - calls it

   Handlers are one-line service calls. Unparseable bodies and unknown types **throw** (`InvalidJobError`) so the provider retries them into its dead-letter queue, rather than dropping them silently.

5. **The runtime adapter lives in the worker app**, as its composition root (the analogue of the API's server entry file). It does three things:
   - builds the services from env with the factories (`loadConfig`, `createAwsStorage`, `createServices`), as the API does
   - feeds each delivered message body to `handleJob`
   - maps a thrown error to the runtime's failure signal: `batchItemFailures` on Lambda, or skipping the delete on a poller

   Nothing else lives there. Replacing Lambda with a poll loop (receive, call `handleJob`, delete on success, drain on SIGTERM) is a new adapter file, with no change to core.

```text
src/
├── domain/jobs/
│   ├── types.ts                     # job envelope schema + Job type
│   └── jobQueue.ts                  # JobQueue interface
├── storage/
│   ├── schedulerClientInstance.ts   # shared SDK clients, passed in by createAwsStorage
│   ├── sqsClientInstance.ts
│   └── JobQueueClient/
│       ├── AwsJobQueueClient.ts     # e.g. Scheduler for runAt, SQS otherwise
│       └── InMemoryJobQueueClient.ts  # test double + runDueJobs
└── transport/jobs.ts                # handleJob + handler table
apps/worker/src/lambda.ts            # runtime adapter + composition root
```

## Rules

- **Jobs are idempotent.** Every provider and runtime delivers at least once, so a handler must tolerate running twice: the work is already done → do nothing. Concurrent-write conflicts should throw, so the job is retried.
- **A service adds a job before the write it protects** when losing the job would be worse than an orphan job, as with an expiry that must never be missed. The job's handler then treats "entity not found" as nothing to do.
- **Test at two seams:**
  - the in-memory Client + `runDueJobs` + `handleJob`, through the router seam once a service adds jobs: submit, advance the clock, run due jobs, assert
  - the real Client with its own SDK clients passed in, mocked with `aws-sdk-client-mock`, asserting the exact provider input

  Provider behaviour that a mock can't confirm (does a past `runAt` fire? does a duplicate name raise a conflict?) belongs in an integration check against the emulator or the real provider.

## Smell tests

- A service or model imports a queue SDK, or names a provider concept (schedule, message group, visibility timeout). → The interface leaked; move the concept into the Client.
- The runtime adapter branches on `job.type`, retries, or validates. → That's transport or service logic, and the next runtime would have to reimplement it.
- A handler in the table does more than call a service. → Move the logic into the service.
- The in-memory Client behaves differently from the real one (runs jobs the real one would delay, ignores a key the real one honours). → Tests pass against a queue that doesn't exist.
