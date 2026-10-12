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
const services = createServices(createStorage(config), clock);

const createContext = ({
  req: _req,
  res: _res,
}: trpcExpress.CreateExpressContextOptions): AppContext => ({
  clock,
  services,
});

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
