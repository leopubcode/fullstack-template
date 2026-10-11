import { publicProcedure, router } from "./trpc";
import { z } from "zod";

const UserListSchema = z.object({
  name: z.string(),
});

export const appRouter = router({
  userList: publicProcedure.input(UserListSchema).query(async ({ input }) => {
    const users = [{ id: 1, name: input.name }];

    return users;
  }),
  submitTestJob: publicProcedure.mutation(({ ctx }) =>
    ctx.services.test.submit(),
  ),
});

export type AppRouter = typeof appRouter;
