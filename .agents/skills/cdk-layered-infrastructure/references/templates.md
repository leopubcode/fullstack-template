# Templates

TypeScript CDK v2. The names (`orders`, `events`, `uploads`, `/resources/...`) are placeholders; adapt them to the project. The same shapes port directly to CDK in other languages.

Contents

1. Env-var contract (app config)
2. SSM parameter names
3. A resource construct
4. Resources stack and its app
5. Lookup: SharedResources
6. Access construct
7. Compute construct
8. App stack
9. Tests
10. Gotchas

## 1. Env-var contract (app config)

Lives with the app's runtime config loader, so infra and runtime share one source.

```ts
// <shared package>/src/config.ts
export const ENV = {
  ordersTableName: "ORDERS_TABLE_NAME",
  eventsQueueUrl: "EVENTS_QUEUE_URL",
  uploadsBucketName: "UPLOADS_BUCKET_NAME",
} as const;

export function loadOrdersConfig(env: Record<string, string | undefined>) {
  return { tableName: requireEnv(env, ENV.ordersTableName) };
}
```

## 2. SSM parameter names

```ts
// infra/parameters.ts
export const PARAMETERS = {
  ordersTableName: "/resources/orders-table-name",
  eventsQueueArn: "/resources/events-queue-arn",
  eventsQueueUrl: "/resources/events-queue-url",
  uploadsBucketName: "/resources/uploads-bucket-name",
  uploadsBucketArn: "/resources/uploads-bucket-arn",
} as const;
```

Publish only what consumers need to rebuild a handle (see Gotchas for which importer takes what).

## 3. A resource construct

Configures one resource completely, and nothing about who uses it.

```ts
// infra/resources/UploadsBucket.ts
export interface UploadsBucketProps {
  allowedOrigins: string[];
  removalPolicy: RemovalPolicy;
}

export class UploadsBucket extends Construct {
  readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: UploadsBucketProps) {
    super(scope, id);
    this.bucket = new s3.Bucket(this, "Bucket", {
      removalPolicy: props.removalPolicy,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: props.allowedOrigins,
          allowedHeaders: ["*"],
        },
      ],
    });
  }
}
```

## 4. Resources stack and its app

```ts
// infra/ResourcesStack.ts
export type Stage = "local" | "aws";

// A cross-layer invariant owned by the resource layer (see SKILL.md).
export const WORKER_MAX_TIMEOUT = Duration.seconds(30);

export interface ResourcesStackProps extends StackProps {
  stage: Stage;
  allowedOrigins: string[];
}

export class ResourcesStack extends Stack {
  constructor(scope: Construct, id: string, props: ResourcesStackProps) {
    super(scope, id, props);
    const removalPolicy =
      props.stage === "local" ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN;

    const { table } = new OrdersTable(this, "OrdersTable", { removalPolicy });
    const { queue } = new EventsQueue(this, "EventsQueue", {
      visibilityTimeout: Duration.seconds(WORKER_MAX_TIMEOUT.toSeconds() * 6),
      removalPolicy,
    });
    const { bucket } = new UploadsBucket(this, "UploadsBucket", {
      allowedOrigins: props.allowedOrigins,
      removalPolicy,
    });

    // Typed against PARAMETERS so a missing value fails to compile.
    const values: Record<keyof typeof PARAMETERS, string> = {
      ordersTableName: table.tableName,
      eventsQueueArn: queue.queueArn,
      eventsQueueUrl: queue.queueUrl,
      uploadsBucketName: bucket.bucketName,
      uploadsBucketArn: bucket.bucketArn,
    };
    for (const [key, value] of Object.entries(values)) {
      new ssm.StringParameter(this, `${key}Parameter`, {
        parameterName: PARAMETERS[key as keyof typeof PARAMETERS],
        stringValue: value,
      });
    }

    // For humans and local .env files only.
    new CfnOutput(this, "OrdersTableName", { value: table.tableName });
  }
}
```

```ts
// infra/app.ts: same stage/context handling as the app stacks
const app = new App();
const stage = app.node.tryGetContext("stage");
const allowedOrigins = app.node.tryGetContext("allowedOrigins") ?? [
  "http://localhost:5173",
];
new ResourcesStack(app, "Resources", { stage, allowedOrigins });
```

## 5. Lookup: SharedResources

```ts
// infra/SharedResources.ts
export class SharedResources extends Construct {
  readonly orders: { readWrite: Access; read: Access };
  readonly events: { queue: sqs.IQueue; publish: Access };
  readonly uploads: { put: Access; reference: Access };

  constructor(scope: Construct, id: string) {
    super(scope, id);
    const parameter = (name: keyof typeof PARAMETERS) =>
      ssm.StringParameter.valueForStringParameter(this, PARAMETERS[name]);

    const table = dynamodb.Table.fromTableName(
      this,
      "OrdersTable",
      parameter("ordersTableName"),
    );
    const ordersEnv = { [ENV.ordersTableName]: table.tableName };
    this.orders = {
      readWrite: { env: ordersEnv, grant: (g) => table.grantReadWriteData(g) },
      read: { env: ordersEnv, grant: (g) => table.grantReadData(g) },
    };

    const queue = sqs.Queue.fromQueueAttributes(this, "EventsQueue", {
      queueArn: parameter("eventsQueueArn"),
      queueUrl: parameter("eventsQueueUrl"),
    });
    this.events = {
      queue, // a handle for compute triggers (event sources)
      publish: {
        env: { [ENV.eventsQueueUrl]: queue.queueUrl },
        grant: (g) => queue.grantSendMessages(g),
      },
    };

    const bucket = s3.Bucket.fromBucketAttributes(this, "UploadsBucket", {
      bucketName: parameter("uploadsBucketName"),
      bucketArn: parameter("uploadsBucketArn"),
    });
    const uploadsEnv = { [ENV.uploadsBucketName]: bucket.bucketName };
    this.uploads = {
      put: { env: uploadsEnv, grant: (g) => bucket.grantPut(g) },
      reference: { env: uploadsEnv, grant: () => {} }, // env only, no rights
    };
  }
}
```

An access that needs several resources (e.g. a queue plus a scheduler group plus `iam:PassRole` on the scheduler's role) is still one access: set all its env vars and apply all its grants together.

## 6. Access construct

Generic over the runtime: anything that can take env vars and has a principal.

```ts
// infra/ResourceAccess.ts
export interface Access {
  env: Record<string, string>;
  grant(grantee: iam.IGrantable): void;
}

export interface AccessTarget extends iam.IGrantable {
  addEnvironment(name: string, value: string): unknown;
}

export class ResourceAccess extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: { target: AccessTarget; accesses: Access[] },
  ) {
    super(scope, id);
    for (const access of props.accesses) {
      for (const [name, value] of Object.entries(access.env)) {
        props.target.addEnvironment(name, value);
      }
      access.grant(props.target);
    }
  }
}
```

- A `lambda.Function` is an `AccessTarget` as is.
- ECS/Fargate: adapt the container and the task role.
  ```ts
  const target: AccessTarget = {
    grantPrincipal: taskDefinition.taskRole.grantPrincipal,
    addEnvironment: (name, value) => container.addEnvironment(name, value),
  };
  ```

## 7. Compute construct

```ts
// <app>/infra/Worker.ts
export interface WorkerProps {
  queue: sqs.IQueue; // a handle passed in, never looked up here
  timeout: Duration;
  environment?: Record<string, string>;
}

export class Worker extends Construct {
  readonly function: lambda.Function;

  constructor(scope: Construct, id: string, props: WorkerProps) {
    super(scope, id);
    this.function = new lambda.Function(this, "Function", {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "lambda.handler",
      code: lambda.Code.fromAsset(
        fileURLToPath(new URL("../dist", import.meta.url)),
      ),
      timeout: props.timeout,
      environment: props.environment,
    });
    this.function.addEventSource(
      new SqsEventSource(props.queue, { reportBatchItemFailures: true }),
    );
  }
}
```

The event source grants its own consume rights. That's fine, because the trigger is part of the runtime.

## 8. App stack

```ts
// <app>/infra/WorkerStack.ts
export class WorkerStack extends Stack {
  constructor(scope: Construct, id: string, props: WorkerStackProps) {
    super(scope, id, props);
    const resources = new SharedResources(this, "Resources");

    const worker = new Worker(this, "Worker", {
      queue: resources.events.queue,
      timeout: WORKER_MAX_TIMEOUT,
      environment:
        props.stage === "local" ? { NODE_ENV: "development" } : undefined,
    });

    new ResourceAccess(this, "WorkerAccess", {
      target: worker.function,
      accesses: [resources.orders.readWrite, resources.uploads.reference],
    });
  }
}
```

## 9. Tests

```ts
// A stack with one function and the given accesses.
function synth(pick: (r: SharedResources) => Access[]): Template {
  const stack = new Stack(new App(), "Test");
  const resources = new SharedResources(stack, "Resources");
  const fn = new lambda.Function(stack, "Fn", {
    runtime: lambda.Runtime.NODEJS_22_X,
    handler: "index.handler",
    code: lambda.Code.fromInline("exports.handler = async () => {}"),
  });
  new ResourceAccess(stack, "Access", {
    target: fn,
    accesses: pick(resources),
  });
  return Template.fromStack(stack);
}

it("reads values from SSM, never from exports", () => {
  const t = synth((r) => [r.orders.readWrite]);
  t.hasParameter("*", {
    Type: "AWS::SSM::Parameter::Value<String>",
    Default: PARAMETERS.ordersTableName,
  });
  expect(JSON.stringify(t.toJSON())).not.toContain("Fn::ImportValue");
});

it("grants nothing for an env-only access", () => {
  synth((r) => [r.uploads.reference]).resourceCountIs("AWS::IAM::Policy", 0);
});

it("publishes one SSM parameter per value", () => {
  const t = Template.fromStack(
    new ResourcesStack(new App(), "R", { stage: "local", allowedOrigins: [] }),
  );
  const names = Object.values(t.findResources("AWS::SSM::Parameter")).map(
    (r) => r.Properties.Name,
  );
  expect(names.sort()).toEqual(Object.values(PARAMETERS).sort());
});
```

## 10. Gotchas

- `Table.fromTableAttributes` accepts **either** `tableName` **or** `tableArn`, not both. Use `Table.fromTableName` for a same-account, same-region table and publish only the name. For a table with streams or indexes you grant on, publish what `fromTableAttributes` needs instead (`tableArn`, `tableStreamArn`, `globalIndexes`).
- `Queue.fromQueueAttributes` needs both ARN and URL to support grants (ARN) and env (URL).
- `Role.fromRoleArn(..., { mutable: false })` keeps CDK from attaching policies to a role that belongs to another stack; `grantPassRole` still works.
- `valueForStringParameter` caches per name within a stack, so calling it once per parameter in the lookup is enough.
- SSM-resolved values are deploy-time tokens, so you can't branch on them in CDK code. Compute anything conditional from context or props instead.
- Apps that import the shared infra as TypeScript need a TS-capable CDK `app` command (e.g. `npx tsx infra/app.ts`).
