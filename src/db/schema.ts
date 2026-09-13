import { boolean, date, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const demoBookings = pgTable("demo_bookings", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: uuid("request_id").notNull().unique(),
  fullName: varchar("full_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  zip: varchar("zip", { length: 5 }).notNull(),
  service: varchar("service", { length: 32 }).notNull(),
  preferredDate: date("preferred_date").notNull(),
  timePreference: varchar("time_preference", { length: 16 }).notNull(),
  notes: text("notes").notNull().default(""),
  consent: boolean("consent").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("requested"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("demo_bookings_email_created_idx").on(table.email, table.createdAt),
]);
