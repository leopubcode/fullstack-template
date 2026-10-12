import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { Role } from "../domain/users/types";

// The Postgres tables, as Drizzle sees them. drizzle-kit diffs this file to
// generate the SQL migrations in ../../drizzle (npm run db:generate).

export const users = pgTable("users", {
  // The identity provider's subject (Keycloak's user id).
  id: text().primaryKey(),
  email: text().notNull(),
  displayName: text("display_name").notNull(),
  roles: text().array().$type<Role[]>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
