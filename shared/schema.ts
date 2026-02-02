
import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subject: text("subject").notNull(),
  semester: text("semester").notNull(),
  description: text("description"),
  fileUrl: text("file_url").notNull(),
  fileName: text("file_name").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  notes: many(notes),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  author: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users);
export const insertNoteSchema = createInsertSchema(notes).omit({ 
  id: true, 
  userId: true, 
  createdAt: true 
});

export type User = typeof users.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertNote = z.infer<typeof insertNoteSchema>;
