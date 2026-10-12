import { initTRPC, TRPCError } from "@trpc/server";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";
import type { AppContext } from "./context";
import {
  AccountExistsError,
  AccountNotConfirmedError,
  InvalidConfirmationCodeError,
  InvalidCredentialsError,
  InvalidPasswordError,
  NotAuthenticatedError,
} from "./domain/identity/errors";

const t = initTRPC.context<AppContext>().create();

// The tRPC code each domain error is answered with. Errors not listed here
// stay INTERNAL_SERVER_ERROR.
const ERROR_CODES: [new () => Error, TRPC_ERROR_CODE_KEY][] = [
  [NotAuthenticatedError, "UNAUTHORIZED"],
  [InvalidCredentialsError, "UNAUTHORIZED"],
  [AccountExistsError, "CONFLICT"],
  [AccountNotConfirmedError, "PRECONDITION_FAILED"],
  [InvalidConfirmationCodeError, "BAD_REQUEST"],
  [InvalidPasswordError, "BAD_REQUEST"],
];

const mapDomainErrors = t.middleware(async ({ next }) => {
  const result = await next();
  if (!result.ok) {
    const cause = result.error.cause;
    const match = ERROR_CODES.find(([type]) => cause instanceof type);
    if (match) {
      throw new TRPCError({ code: match[1], message: cause!.message, cause });
    }
  }
  return result;
});

const requireUser = t.middleware(async ({ ctx, next }) => {
  const user = await ctx.services.auth.authenticate(ctx.accessToken);
  return next({ ctx: { user } });
});

export const router = t.router;
export const publicProcedure = t.procedure.use(mapDomainErrors);
// A procedure only a signed-in caller may run, with their user on ctx.user.
export const protectedProcedure = publicProcedure.use(requireUser);
