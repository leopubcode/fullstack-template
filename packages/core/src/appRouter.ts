import { publicProcedure, router } from "./trpc";
import { z } from "zod";

const UserListSchema = z.object({
  name: z.string(),
});

export const appRouter = router({
  userList: publicProcedure.input(UserListSchema).query(async ({ ctx }) => {
    const users = await ctx.services.users.list();

    return users;
  }),
});

export type AppRouter = typeof appRouter;
