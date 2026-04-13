
import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const userRoleSchema = z.enum(["student", "faculty"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  fullName: text("full_name"),
  nickName: text("nick_name"),
  email: text("email").unique(),
  phone: text("phone").unique(), // legacy (kept for backward compatibility)
  mobileNumber: text("mobile_number").unique(),
  role: text("role").$type<UserRole>(),
  isEmailVerified: boolean("is_email_verified").notNull().default(false),
  isMobileVerified: boolean("is_mobile_verified").notNull().default(false),
  password: text("password").notNull(),
  department: text("department"),
  year: integer("year"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

export const downloads = pgTable(
  "downloads",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull(),
    noteId: integer("note_id").notNull(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => ({
    userNoteUniq: uniqueIndex("downloads_user_note_uniq").on(t.userId, t.noteId),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  notes: many(notes),
  downloads: many(downloads),
}));

export const notesRelations = relations(notes, ({ one, many }) => ({
  author: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
  downloads: many(downloads),
}));

export const downloadsRelations = relations(downloads, ({ one }) => ({
  user: one(users, {
    fields: [downloads.userId],
    references: [users.id],
  }),
  note: one(notes, {
    fields: [downloads.noteId],
    references: [notes.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users);
export const insertNoteSchema = createInsertSchema(notes).omit({ 
  id: true, 
  userId: true, 
  createdAt: true 
});

const identifierSchema = z
  .string()
  .trim()
  .min(1, "Email or phone is required")
  .max(254, "Email or phone is too long");

const optionalNonEmptyString = (max: number, label: string) =>
  z
    .preprocess(
      (v) => {
        if (typeof v !== "string") return v;
        const trimmed = v.trim();
        return trimmed.length === 0 ? undefined : trimmed;
      },
      z.string().min(1, `${label} is required`).max(max, `${label} is too long`),
    )
    .optional();

const optionalEmailSchema = z
  .preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      const trimmed = v.trim();
      return trimmed.length === 0 ? undefined : trimmed.toLowerCase();
    },
    z.string().email("Enter a valid email").max(254, "Email is too long"),
  )
  .optional();

const optionalMobileSchema = z
  .preprocess(
    (v) => {
      if (typeof v !== "string") return v;
      const trimmed = v.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().regex(/^\+?\d{7,15}$/, "Enter a valid mobile number"),
  )
  .optional();

export const authRegisterSchema = z.object({
  // New flow
  nickName: optionalNonEmptyString(48, "Nickname"),
  email: optionalEmailSchema,
  mobileNumber: optionalMobileSchema,
  role: userRoleSchema.optional(),

  // Backward compatible (old clients)
  identifier: identifierSchema.optional(),
  department: optionalNonEmptyString(64, "Department"),
  year: z
    .preprocess(
      (v) => {
        if (v === undefined || v === null || v === "") return undefined;
        return v;
      },
      z.coerce
        .number()
        .int()
        .min(1, "Year must be between 1 and 6")
        .max(6, "Year must be between 1 and 6"),
    )
    .optional(),

  password: z.string().min(6, "Password must be at least 6 characters").max(72),
}).superRefine((data, ctx) => {
  const hasContact = Boolean(data.email || data.mobileNumber || data.identifier);
  if (!hasContact) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Provide at least one contact method (email or mobile number)",
      path: ["email"],
    });
  }
  if (!data.nickName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Nickname is required",
      path: ["nickName"],
    });
  }
});

export const authLoginSchema = z.object({
  identifier: identifierSchema,
  password: z.string().min(1, "Password is required").max(72),
});

export const authOtpRequestSchema = z.object({
  identifier: identifierSchema,
});

export const authOtpVerifySchema = z.object({
  identifier: identifierSchema,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const userProfileSchema = z.object({
  department: z.string().trim().min(1, "Department is required").max(64),
  year: z.coerce.number().int().min(1, "Year must be between 1 and 6").max(6, "Year must be between 1 and 6"),
});

const emptyStringToNull = (v: unknown) => {
  if (typeof v !== "string") return v;
  const trimmed = v.trim();
  return trimmed.length === 0 ? null : trimmed;
};

export const userIdentityUpdateSchema = z.object({
  fullName: z
    .preprocess(emptyStringToNull, z.string().max(120, "Full name is too long").nullable())
    .optional(),
  nickName: z
    .preprocess(
      (v) => (typeof v === "string" ? v.trim() : v),
      z.string().min(1, "Nickname is required").max(48, "Nickname is too long"),
    )
    .optional(),
  email: z
    .preprocess(
      (v) => {
        const normalized = emptyStringToNull(v);
        if (typeof normalized === "string") return normalized.toLowerCase();
        return normalized;
      },
      z.string().email("Enter a valid email").max(254, "Email is too long").nullable(),
    )
    .optional(),
  mobileNumber: z
    .preprocess(
      emptyStringToNull,
      z.string().regex(/^\+?\d{7,15}$/, "Enter a valid mobile number").nullable(),
    )
    .optional(),
  role: userRoleSchema.optional(),
});

export const verifyEmailSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(254),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code").optional(),
});

export const verifyMobileSchema = z.object({
  mobileNumber: z.string().trim().regex(/^\+?\d{7,15}$/, "Enter a valid mobile number"),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code").optional(),
});

export const passwordResetRequestSchema = z.object({
  identifier: identifierSchema,
});

export const passwordResetConfirmSchema = z.object({
  identifier: identifierSchema,
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  newPassword: z.string().min(6, "Password must be at least 6 characters").max(72),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required").max(72),
  newPassword: z.string().min(6, "New password must be at least 6 characters").max(72),
});

export type User = typeof users.$inferSelect;
export type Note = typeof notes.$inferSelect;
export type Download = typeof downloads.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type AuthRegisterInput = z.infer<typeof authRegisterSchema>;
export type AuthLoginInput = z.infer<typeof authLoginSchema>;
export type AuthOtpRequestInput = z.infer<typeof authOtpRequestSchema>;
export type AuthOtpVerifyInput = z.infer<typeof authOtpVerifySchema>;
export type UserProfileInput = z.infer<typeof userProfileSchema>;
export type UserIdentityUpdateInput = z.infer<typeof userIdentityUpdateSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type VerifyMobileInput = z.infer<typeof verifyMobileSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
