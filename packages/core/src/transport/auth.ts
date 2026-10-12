import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../trpc";

const email = z.email().trim().toLowerCase();

export const authRouter = router({
  signUp: publicProcedure
    .input(
      z.object({
        email,
        password: z.string().min(1),
        displayName: z.string().trim().min(1),
      }),
    )
    .mutation(({ input, ctx }) => ctx.services.auth.signUp(input)),

  resendVerification: publicProcedure
    .input(z.object({ email }))
    .mutation(({ input, ctx }) => ctx.services.auth.resendVerification(input)),

  signIn: publicProcedure
    .input(z.object({ email, password: z.string().min(1) }))
    .mutation(({ input, ctx }) => ctx.services.auth.signIn(input)),

  refresh: publicProcedure
    .input(z.object({ refreshToken: z.string().min(1) }))
    .mutation(({ input, ctx }) => ctx.services.auth.refresh(input)),

  // Public, so a session whose access token has expired can still end.
  signOut: publicProcedure
    .input(z.object({ refreshToken: z.string().min(1) }))
    .mutation(({ input, ctx }) => ctx.services.auth.signOut(input)),

  me: protectedProcedure.query(({ ctx }) => ctx.user),
});
