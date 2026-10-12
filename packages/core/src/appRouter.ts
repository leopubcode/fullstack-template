import { publicProcedure, router } from "./trpc";
import { z } from "zod";
import { authRouter } from "./transport/auth";

const UserListSchema = z.object({
  name: z.string(),
});

export const appRouter = router({
  auth: authRouter,
  userList: publicProcedure.input(UserListSchema).query(async ({ ctx }) => {
    const users = await ctx.services.users.list();

    return users;
  }),
  submitTestJob: publicProcedure.mutation(
    async ({ ctx }) => await ctx.services.test.submit(),
  ),
});

export type AppRouter = typeof appRouter;
