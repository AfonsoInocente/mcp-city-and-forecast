/**
 * This file is used to define the schema for the database.
 *
 * After making changes to this file, run `npm run db:generate` to generate the migration file.
 * Then, by just using the app, the migration is lazily ensured at runtime.
 */
import { integer, sqliteTable, text } from "@deco/workers-runtime/drizzle";

export const conversationsTable = sqliteTable("conversations", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const messagesTable = sqliteTable("messages", {
  id: integer("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  role: text("role").notNull(), // "user" or "assistant"
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const todosTable = sqliteTable("todos", {
  id: integer("id").primaryKey(),
  title: text("title"),
  completed: integer("completed").default(0),
});
