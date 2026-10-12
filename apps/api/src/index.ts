import * as trpcExpress from "@trpc/server/adapters/express";
import express from "express";
import cors from "cors";
import {
  type AppContext,
  appRouter,
  createStorage,
  createServices,
  createSystemClock,
  loadConfig,
} from "@repo/core";

// The composition root: builds the services from env once, at startup, and
// hands the same ones to every request.
const config = loadConfig(process.env);
const clock = createSystemClock();
const services = createServices(createStorage(config, clock), clock);

// Each request's context carries the bearer token from its Authorization
// header, if any; protected procedures resolve it to the caller's user.
const createContext = ({
  req,
}: trpcExpress.CreateExpressContextOptions): AppContext => ({
  clock,
  services,
  accessToken: bearerToken(req.headers.authorization),
});

function bearerToken(header: string | undefined): string | undefined {
  return header?.match(/^Bearer\s+(\S+)$/i)?.[1];
}

const app = express();

app.use(cors());

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  }),
);

app.listen(4000, () => console.log("listening on :4000"));
