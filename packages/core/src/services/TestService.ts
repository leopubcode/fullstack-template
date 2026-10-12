import type { Clock } from "../domain/clock";
import type { JobQueue } from "../domain/jobs/jobQueue";

const DAY = 24 * 60 * 60 * 1000;

export class TestService {
  constructor(
    private readonly jobQueue: JobQueue,
    private readonly clock: Clock,
  ) {}

  async submit(): Promise<void> {
    await this.jobQueue.add(
      { type: "Testing", foo: "aaa" },
      {
        runAt: new Date(this.clock.now().getTime() + DAY),
        key: "mykey",
      },
    );
  }

  async doTestWork(foo: string): Promise<void> {
    console.log(foo);
  }
}
