# Migrating a coupled CDK codebase

The starting point is usually compute constructs that each import resources (`Fn.importValue`, `fromXxx`), set resource env vars, and call `grant*`. Resources sit in whichever app stack deploys first, and some may be created outside CDK by scripts.

## Steps

1. **Inventory before touching anything.** Synth every app and record, per function: its env-var keys and its set of IAM actions. This is the baseline the refactor must reproduce.
2. **Centralize the env-var names.** Add the shared `ENV` constant to the app's config module and make the config loaders use it. Behavior doesn't change.
3. **Create the shared infra.** Move each resource construct into `<shared package>/infra/resources/` unchanged (`git mv` keeps history). Add any resources that scripts used to create (e.g. a table from a setup script) as constructs. Then add `parameters.ts`, `ResourcesStack.ts` (with SSM parameters and outputs), and the Resources stack's own `app.ts`/`cdk.json` and deploy scripts.
4. **Add the lookup and the access construct.** Turn each block of `importValue`/`fromXxx` + env + grants into one named access on the lookup. Grants that were duplicated across runtimes become one access used by both.
5. **Strip compute.** Each compute construct keeps only runtime settings and its trigger, and takes resource handles as props. Delete the export-name files, the resource props (`tableNames`, ARNs) and their CDK context entries.
6. **Rewire each app stack** as lookup → compute → `ResourceAccess`.
7. **Retire the old setup.** Remove setup scripts that created resources, their package/task-runner scripts, and env examples only they used. Point local env examples at the Resources stack's outputs.
8. **Verify.** Synth again and diff against step 1: env keys and IAM actions should match exactly per function, and `Fn::ImportValue` should be gone. Add the assertion tests from templates.md. Deploy Resources → apps on an emulator or a sandbox account.

## Deployment consequences to call out

- **Moving a resource between stacks replaces it.** CloudFormation can't transfer ownership in a normal deploy. With `RETAIN`, the old resource is orphaned, not deleted, and the new stack creates a fresh one. Data needs a migration (copy, or a CloudFormation resource import into the new stack). Flag this before deploying to any environment with real data.
- **Auto-generated names change.** Resources that used fixed names (often because a script created them) get CDK-generated names. Every consumer must read the name from config, never hardcode it.
- **Deploy order changes** to Resources first. Old app stacks that still export values must be updated, or have those exports removed after nothing imports them.
- **Local emulators** keep the old resources in persisted volumes. Recreate the volume for a clean start.
