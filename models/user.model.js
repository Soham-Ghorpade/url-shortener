import { primaryKey } from "drizzle-orm/cockroach-core";
import { pgTable , uuid} from "drizzle-orm/pg-core";
export const usersTable = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  // ...
});