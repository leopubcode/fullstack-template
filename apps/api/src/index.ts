import * as trpcExpress from "@trpc/server/adapters/express";
import express from "express";
import cors from "cors";
import {
  type AppContext,
  appRouter,
  createPostgresStorage,
  createServices,
  loadConfig,
} from "@repo/core";

// The composition root: builds the services from env once, at startup, and
// hands the same ones to every request.
const config = loadConfig(process.env);
const services = createServices(createPostgresStorage(config));

const createContext = ({
  req: _req,
  res: _res,
}: trpcExpress.CreateExpressContextOptions): AppContext => ({
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
