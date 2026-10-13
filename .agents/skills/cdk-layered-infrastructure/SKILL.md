---
name: cdk-layered-infrastructure
description: "Structures AWS CDK infrastructure into three decoupled layers: Resources, Compute, and Access. Use when writing or reviewing CDK stacks/constructs and or managing AWS resources."
---

# CDK Layered Infrastructure

Structures AWS CDK infrastructure into three decoupled layers: Resources (stateful, shared resources such as DynamoDB tables, SQS queues, S3 buckets, schedulers, topics, secrets), Compute (an app's own runtime, e.g. a Lambda function or container service), and Access (one construct per app that binds compute to resources by setting env vars and granting IAM). Use when writing or reviewing CDK stacks/constructs, adding a new AWS resource or a new Lambda/ECS/Fargate runtime, granting a function access to a table/queue/bucket, sharing resources between several apps or stacks, choosing between CloudFormation exports (Fn.importValue) and SSM parameters for cross-stack references, fixing deploy-order or 'export in use' problems, or untangling constructs that create resources, import other stacks' resources, set env vars and call grant* all in one place — even if the user doesn't name these layers.

Split every CDK app into three layers, each with one reason to change:

```
Resources  ──(SSM parameters)──▶  Lookup  ──▶  Access  ◀──  Compute
 owns the stateful things          rebuilds     binds one     defines one
 knows no consumers                handles      runtime to    runtime only
                                                resources
```

- **Resources** change when the data model or messaging changes.
- **Compute** changes when a runtime changes (memory, timeout, Lambda → container).
- **Access** changes when what a runtime may touch changes, and nothing else does.

The failure this prevents: a compute construct that imports every resource, hardcodes the env-var names the app reads, and calls every `grant*`. Then every runtime knows every resource, resources end up in whichever stack happens to deploy first, and adding one bucket edits every function.

## The layers

### 1. Resources: a stack of shared, stateful resources

- Holds tables, queues, buckets, topics, schedule groups, secrets: anything with data or identity that outlives a deploy, or that more than one runtime uses.
- One small construct per resource (`OrdersTable`, `EventsQueue`, `UploadsBucket`). It configures the resource itself: keys, billing, CORS, DLQ, alarms, removal policy.
- **Knows no consumers.** No function names, no grants to app roles, no app env vars. Grants _between resources_ belong here (a scheduler's role sending to a queue, a bucket notifying a topic), because they are part of the resource's own wiring.
- Publishes every identifier a consumer needs (name, ARN, URL) to an **SSM parameter**, with names from one constant map. It also adds `CfnOutput`s so local `.env` files can be filled in.
- Picks the removal policy from the stage: `DESTROY` for local or ephemeral stages, `RETAIN` where data matters.

### 2. Compute: one construct per app runtime

- Defines only the runtime: code asset, handler, runtime version, architecture, memory, timeout, stage-specific env (e.g. `NODE_ENV`), and the entry point (Function URL, API, schedule).
- An event source that _is_ the runtime's trigger (`SqsEventSource`) takes a resource **handle** as a prop. The compute construct never looks resources up itself.
- Exposes the function or task so the stack can hand it to Access.

### 3. Access: the only place compute meets resources

- A **lookup** construct reads the SSM parameters with `ssm.StringParameter.valueForStringParameter` and rebuilds handles with `fromXxx` importers (`Table.fromTableName`, `Queue.fromQueueAttributes`, `Bucket.fromBucketAttributes`, `Role.fromRoleArn(..., { mutable: false })`).
- It exposes named **accesses**, each one way of using a resource: `orders.readWrite`, `events.publish`, `uploads.put`. An access is `{ env, grant }`: the env vars the app's config reads to find the resource, plus the IAM rights that use needs. Name accesses for the use, not the IAM action, and give each one exactly one config section of the app.
- An **access construct** takes a runtime (a Lambda function, or an adapter over an ECS container and its task role) and a list of accesses. It sets each env var and applies each grant:
  ```ts
  new ResourceAccess(this, "ApiAccess", {
    target: api.function,
    accesses: [
      resources.orders.readWrite,
      resources.events.publish,
      resources.uploads.put,
    ],
  });
  ```
- Keep env-var names in **one constant shared with the app's runtime config loader**. The infra sets exactly the names the app reads, and a rename is one edit.
- An env-only access with a no-op grant is fine when a runtime's config requires a value it never uses. Prefer fixing the config so it loads only the sections that runtime needs.

Full templates for every piece: [references/templates.md](references/templates.md).

## Where code lives

```
<shared package>/infra/            # owned by whoever owns the resources (often the packages/core package)
  resources/<Resource>.ts          # one construct per resource
  ResourcesStack.ts                # creates resources, writes SSM parameters, outputs
  parameters.ts                    # SSM parameter names, one constant map
  SharedResources.ts               # lookup: SSM → handles → typed accesses
  ResourceAccess.ts                # Access interface + binding construct
  app.ts, cdk.json                 # the Resources stack's own CDK app
  index.ts                         # exports lookup, ResourceAccess, Access, shared constants
<app>/infra/
  <Runtime>.ts                     # compute only
  <App>Stack.ts                    # lookup + compute + ResourceAccess
  app.ts, cdk.json
```

- Apps import the shared infra through a package subpath (e.g. `@scope/core/infra`). Keep it **outside the runtime bundle's entry** so CDK never ships inside a Lambda.
- Install exactly **one copy of `aws-cdk-lib` and `constructs`** across the workspace. Constructs from two copies fail `instanceof`/identity checks at synth.
- Deploy order: Resources first, then the app stacks in any order. App stacks never depend on each other.

## Cross-stack references: SSM parameters, not exports

Use SSM parameters, not `Fn.importValue`:

- A CloudFormation export can't change or be deleted while any stack imports it. Replacing a resource then means first removing every consumer.
- SSM decouples the lifecycles: consumers pick up a new value on their next deploy.
- `valueForStringParameter` becomes a CloudFormation parameter of type `AWS::SSM::Parameter::Value<String>`, resolved at deploy time. LocalStack supports this too.
- The cost: no deploy-time guard against deleting a resource that's still in use. Mitigate with `RETAIN` on stateful resources.

Use plain `CfnOutput`s only for humans and local tooling, never for stack-to-stack wiring.

## Invariants spanning layers

When a resource setting depends on a runtime setting, make the **resource layer own the constant** and have compute import it. Dependencies point from compute to resources, never the other way. Example: an SQS event source wants the queue's visibility timeout ≥ 6× the function timeout. Export `WORKER_MAX_TIMEOUT` from the shared infra, derive the visibility timeout from it, and use it as the worker's timeout.

## Decision checklist

1. Does it hold data, or will a second runtime ever use it? → **Resources**.
2. Is it how one runtime executes (code, memory, timeout, trigger)? → **Compute**.
3. Is it an env var pointing at a resource, or a `grant*` to a runtime? → **Access**, via an access on the lookup.
4. Is it a grant between two resources? → **Resources**, next to them.

**Smell tests**

- A compute construct imports SSM parameters, `fromXxx` importers or `grant*`: access has leaked into compute.
- A resource construct takes a function or role from an app: consumer knowledge has leaked into resources.
- A string env-var name appears in both infra and app code: the contract has been duplicated.
- An app stack reads another app stack's outputs, or `Fn.importValue` appears anywhere: wiring has bypassed the Resources stack.

## Verifying a change

- Add CDK assertion tests (`aws-cdk-lib/assertions`): the resources stack writes one SSM parameter per published value; an access sets its env vars and IAM actions; an env-only access creates no policy.
- When refactoring an existing coupled app, synth before and after. Diff each function's env-var keys and its set of IAM actions; they should match exactly. Assert `Fn::ImportValue` is gone.
- For LocalStack, deploy the Resources stack, list the parameters (`ssm get-parameters-by-path --path /<prefix>`), then deploy an app stack.

To move an existing coupled codebase onto this layout, follow [references/migration.md](references/migration.md).
