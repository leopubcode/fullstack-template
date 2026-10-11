import { z } from "zod";

// Work a service hands off to run later, outside the request that asked for
// it. Every job is a plain JSON envelope, discriminated by `type`, so it can
// travel through any queue unchanged.
export const jobSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("Testing"),
    foo: z.string(),
  }),
]);

export type Job = z.infer<typeof jobSchema>;

export type JobType = Job["type"];
