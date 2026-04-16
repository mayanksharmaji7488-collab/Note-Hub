
import {
  downloads,
  notes,
  users,
  type InsertNote,
  type InsertUser,
  type Note,
  type User,
} from "@shared/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import session from "express-session";
import connectPg from "connect-pg-simple";
import fs from "node:fs";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const PostgresSessionStore = connectPg(session);

export type CohortScope = { department: string; year: number };

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByIdentifier(identifier: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByMobile(mobileNumber: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserProfile(userId: number, profile: CohortScope): Promise<User>;
  updateUserIdentityProfile(userId: number, patch: Partial<InsertUser>): Promise<User>;
  updateUserPassword(userId: number, passwordHash: string): Promise<User>;
  
  createNote(note: InsertNote & { userId: number }): Promise<Note>;
  deleteNote(noteId: number): Promise<Note | undefined>;
  getNotes(scope: CohortScope, search?: string): Promise<(Note & { author: string; authorBranch: string | null; authorYear: number | null })[]>;
  getAllNotes(search?: string): Promise<(Note & { author: string; authorBranch: string | null; authorYear: number | null })[]>;
  getNotesByDate(
    scope: CohortScope,
    date: string,
    search?: string,
  ): Promise<(Note & { author: string; authorBranch: string | null; authorYear: number | null })[]>;
  getNote(
    id: number,
    scope: CohortScope,
  ): Promise<(Note & { author: string; authorBranch: string | null; authorYear: number | null }) | undefined>;
  getNoteAny(id: number): Promise<(Note & { author: string; authorBranch: string | null; authorYear: number | null }) | undefined>;
  getMyUploads(userId: number): Promise<(Note & { author: string; authorBranch: string | null; authorYear: number | null })[]>;
  getMyDownloads(userId: number): Promise<(Note & { author: string; downloadedAt: Date | null })[]>;
  recordDownload(userId: number, noteId: number): Promise<void>;
  
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  private db: NodePgDatabase<typeof schema>;

  private constructor(pool: pg.Pool, sessionStore: session.Store) {
    this.db = drizzle(pool, { schema });
    this.sessionStore = sessionStore;
  }

  private static async ensureMinimumSchema(pool: pg.Pool) {
    const res = await pool.query<{ reg: string | null }>(
      `select to_regclass('public.users') as reg`,
    );
    const usersTable = res.rows?.[0]?.reg;
    if (!usersTable) return;

    await pool.query(`alter table public.users add column if not exists department text`);
    await pool.query(`alter table public.users add column if not exists year integer`);

    // Profile & identity system (backward compatible)
    await pool.query(`alter table public.users add column if not exists full_name text`);
    await pool.query(`alter table public.users add column if not exists nick_name text`);
    await pool.query(`alter table public.users add column if not exists mobile_number text`);
    await pool.query(`alter table public.users add column if not exists role text`);
    await pool.query(
      `alter table public.users add column if not exists is_email_verified boolean not null default false`,
    );
    await pool.query(
      `alter table public.users add column if not exists is_mobile_verified boolean not null default false`,
    );
    await pool.query(
      `alter table public.users add column if not exists created_at timestamp default now()`,
    );
    await pool.query(
      `alter table public.users add column if not exists updated_at timestamp default now()`,
    );

    // Ensure uniqueness on the new mobile_number column (partial unique index to allow nulls).
    await pool.query(
      `create unique index if not exists users_mobile_number_uniq on public.users (mobile_number) where mobile_number is not null`,
    );

    // Backfill sensible defaults for existing users.
    await pool.query(
      `update public.users set nick_name = username where nick_name is null`,
    );
    await pool.query(
      `update public.users set role = 'student' where role is null`,
    );
    await pool.query(
      `update public.users set mobile_number = phone where mobile_number is null and phone is not null`,
    );
    await pool.query(
      `update public.users set is_email_verified = true where email is not null`,
    );
    await pool.query(
      `update public.users set is_mobile_verified = true where mobile_number is not null or phone is not null`,
    );
  }

  static async create(): Promise<DatabaseStorage> {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    if (!databaseUrl) {
      throw new Error("DATABASE_URL must be set to use database storage");
    }

    const pool = createPgPool(databaseUrl);

    try {
      // Preflight connectivity so we can gracefully fall back in dev.
      await pool.query("select 1 as ok");
      await DatabaseStorage.ensureMinimumSchema(pool);
    } catch (err) {
      await pool.end().catch(() => {});
      throw err;
    }

    const sessionStoreMode = process.env.SESSION_STORE?.trim().toLowerCase();
    const isProduction = process.env.NODE_ENV === "production";

    const usePostgresSessions = sessionStoreMode
      ? ["pg", "postgres", "postgresql", "db", "database"].includes(sessionStoreMode)
      : isProduction;

    const sessionStore = usePostgresSessions
      ? new PostgresSessionStore({
          pool,
          createTableIfMissing: true,
        })
      : new session.MemoryStore();

    return new DatabaseStorage(pool, sessionStore);
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return user;
  }

  async getUserByIdentifier(identifier: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(
        or(
          eq(users.username, identifier),
          eq(users.email, identifier),
          eq(users.phone, identifier),
          eq(users.mobileNumber, identifier),
        ),
      );
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByMobile(mobileNumber: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(or(eq(users.mobileNumber, mobileNumber), eq(users.phone, mobileNumber)));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await this.db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserProfile(userId: number, profile: CohortScope): Promise<User> {
    const [user] = await this.db
      .update(users)
      .set({
        department: profile.department,
        year: profile.year,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }

  async updateUserIdentityProfile(userId: number, patch: Partial<InsertUser>): Promise<User> {
    const [user] = await this.db
      .update(users)
      .set({
        ...patch,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }

  async updateUserPassword(userId: number, passwordHash: string): Promise<User> {
    return this.updateUserIdentityProfile(userId, { password: passwordHash });
  }

  async createNote(note: InsertNote & { userId: number }): Promise<Note> {
    const [newNote] = await this.db.insert(notes).values(note).returning();
    return newNote;
  }

  async deleteNote(noteId: number): Promise<Note | undefined> {
    return this.db.transaction(async (tx) => {
      const [existingNote] = await tx.select().from(notes).where(eq(notes.id, noteId));
      if (!existingNote) return undefined;

      await tx.delete(downloads).where(eq(downloads.noteId, noteId));

      const [deletedNote] = await tx.delete(notes).where(eq(notes.id, noteId)).returning();
      return deletedNote ?? existingNote;
    });
  }

  async getNotes(
    scope: CohortScope,
    search?: string,
  ): Promise<(Note & { author: string; authorBranch: string | null; authorYear: number | null })[]> {
    const searchNormalized = search?.trim();

    const conditions = [
      eq(users.department, scope.department),
      eq(users.year, scope.year),
    ];

    if (searchNormalized) {
      const searchCondition = or(
        ilike(notes.title, `%${searchNormalized}%`),
        ilike(notes.subject, `%${searchNormalized}%`),
        ilike(notes.description, `%${searchNormalized}%`),
        ilike(users.username, `%${searchNormalized}%`),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const results = await this.db
      .select({
        id: notes.id,
        title: notes.title,
        subject: notes.subject,
        semester: notes.semester,
        description: notes.description,
        fileUrl: notes.fileUrl,
        fileName: notes.fileName,
        userId: notes.userId,
        createdAt: notes.createdAt,
        author: users.username,
        authorBranch: users.department,
        authorYear: users.year,
      })
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt));
    
    // map null authors to "Unknown" if user deleted
    return results.map(row => ({
      ...row,
      author: row.author || "Unknown"
    }));
  }

  async getNotesByDate(
    scope: CohortScope,
    date: string,
    search?: string,
  ): Promise<(Note & { author: string; authorBranch: string | null; authorYear: number | null })[]> {
    const searchNormalized = search?.trim();

    const conditions = [
      eq(users.department, scope.department),
      eq(users.year, scope.year),
      sql<boolean>`DATE(${notes.createdAt}) = ${date}`,
    ];

    if (searchNormalized) {
      const searchCondition = or(
        ilike(notes.title, `%${searchNormalized}%`),
        ilike(notes.subject, `%${searchNormalized}%`),
        ilike(notes.description, `%${searchNormalized}%`),
        ilike(users.username, `%${searchNormalized}%`),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    const results = await this.db
      .select({
        id: notes.id,
        title: notes.title,
        subject: notes.subject,
        semester: notes.semester,
        description: notes.description,
        fileUrl: notes.fileUrl,
        fileName: notes.fileName,
        userId: notes.userId,
        createdAt: notes.createdAt,
        author: users.username,
        authorBranch: users.department,
        authorYear: users.year,
      })
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt));

    return results.map((row) => ({
      ...row,
      author: row.author || "Unknown",
    }));
  }

  async getAllNotes(search?: string): Promise<(Note & { author: string; authorBranch: string | null; authorYear: number | null })[]> {
    const searchNormalized = search?.trim();

    const searchCondition = searchNormalized
      ? or(
          ilike(notes.title, `%${searchNormalized}%`),
          ilike(notes.subject, `%${searchNormalized}%`),
          ilike(notes.description, `%${searchNormalized}%`),
          ilike(users.username, `%${searchNormalized}%`),
        )
      : undefined;

    const baseQuery = this.db
      .select({
        id: notes.id,
        title: notes.title,
        subject: notes.subject,
        semester: notes.semester,
        description: notes.description,
        fileUrl: notes.fileUrl,
        fileName: notes.fileName,
        userId: notes.userId,
        createdAt: notes.createdAt,
        author: users.username,
        authorBranch: users.department,
        authorYear: users.year,
      })
      .from(notes)
      .leftJoin(users, eq(notes.userId, users.id));

    const results = await (searchCondition ? baseQuery.where(searchCondition) : baseQuery).orderBy(
      desc(notes.createdAt),
    );

    return results.map((row) => ({
      ...row,
      author: row.author || "Unknown",
    }));
  }

  async getNote(
    id: number,
    scope: CohortScope,
  ): Promise<(Note & { author: string; authorBranch: string | null; authorYear: number | null }) | undefined> {
    const [note] = await this.db
      .select({
        id: notes.id,
        title: notes.title,
        subject: notes.subject,
        semester: notes.semester,
        description: notes.description,
        fileUrl: notes.fileUrl,
        fileName: notes.fileName,
        userId: notes.userId,
        createdAt: notes.createdAt,
        author: users.username,
        authorBranch: users.department,
        authorYear: users.year,
      })
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(
        and(
          eq(notes.id, id),
          eq(users.department, scope.department),
          eq(users.year, scope.year),
        ),
      );

    if (!note) return undefined;

    return {
      ...note,
      author: note.author || "Unknown",
    };
  }

  async getNoteAny(id: number): Promise<(Note & { author: string; authorBranch: string | null; authorYear: number | null }) | undefined> {
    const [note] = await this.db
      .select({
        id: notes.id,
        title: notes.title,
        subject: notes.subject,
        semester: notes.semester,
        description: notes.description,
        fileUrl: notes.fileUrl,
        fileName: notes.fileName,
        userId: notes.userId,
        createdAt: notes.createdAt,
        author: users.username,
        authorBranch: users.department,
        authorYear: users.year,
      })
      .from(notes)
      .leftJoin(users, eq(notes.userId, users.id))
      .where(eq(notes.id, id));

    if (!note) return undefined;

    return {
      ...note,
      author: note.author || "Unknown",
    };
  }

  async getMyUploads(userId: number): Promise<(Note & { author: string; authorBranch: string | null; authorYear: number | null })[]> {
    const results = await this.db
      .select({
        id: notes.id,
        title: notes.title,
        subject: notes.subject,
        semester: notes.semester,
        description: notes.description,
        fileUrl: notes.fileUrl,
        fileName: notes.fileName,
        userId: notes.userId,
        createdAt: notes.createdAt,
        author: users.username,
        authorBranch: users.department,
        authorYear: users.year,
      })
      .from(notes)
      .leftJoin(users, eq(notes.userId, users.id))
      .where(eq(notes.userId, userId))
      .orderBy(desc(notes.createdAt));

    return results.map((row) => ({
      ...row,
      author: row.author || "Unknown",
    }));
  }

  async getMyDownloads(
    userId: number,
  ): Promise<(Note & { author: string; downloadedAt: Date | null })[]> {
    const results = await this.db
      .select({
        id: notes.id,
        title: notes.title,
        subject: notes.subject,
        semester: notes.semester,
        description: notes.description,
        fileUrl: notes.fileUrl,
        fileName: notes.fileName,
        userId: notes.userId,
        createdAt: notes.createdAt,
        author: users.username,
        authorBranch: users.department,
        authorYear: users.year,
        downloadedAt: downloads.createdAt,
      })
      .from(downloads)
      .innerJoin(notes, eq(downloads.noteId, notes.id))
      .leftJoin(users, eq(notes.userId, users.id))
      .where(eq(downloads.userId, userId))
      .orderBy(desc(downloads.createdAt));

    return results.map((row) => ({
      ...row,
      author: row.author || "Unknown",
    }));
  }

  async recordDownload(userId: number, noteId: number): Promise<void> {
    await this.db
      .insert(downloads)
      .values({ userId, noteId })
      .onConflictDoNothing({ target: [downloads.userId, downloads.noteId] });
  }
}

export class MemoryStorage implements IStorage {
  sessionStore: session.Store;

  private nextUserId = 1;
  private nextNoteId = 1;
  private nextDownloadId = 1;

  private users: User[] = [];
  private notes: Note[] = [];
  private downloads: { id: number; userId: number; noteId: number; createdAt: Date }[] =
    [];

  constructor() {
    this.sessionStore = new session.MemoryStore();
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.find((u) => u.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find((u) => u.username === username);
  }

  async getUserByIdentifier(identifier: string): Promise<User | undefined> {
    return this.users.find(
      (u) =>
        u.username === identifier ||
        u.email === identifier ||
        u.phone === identifier ||
        u.mobileNumber === identifier,
    );
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.users.find((u) => u.email === email);
  }

  async getUserByMobile(mobileNumber: string): Promise<User | undefined> {
    return this.users.find((u) => u.mobileNumber === mobileNumber || u.phone === mobileNumber);
  }

  async createUser(user: InsertUser): Promise<User> {
    const created: User = {
      id: this.nextUserId++,
      username: user.username,
      password: user.password,
      fullName: user.fullName ?? null,
      nickName: user.nickName ?? null,
      email: user.email ?? null,
      phone: user.phone ?? null,
      mobileNumber: user.mobileNumber ?? null,
      role: user.role ?? null,
      isEmailVerified: user.isEmailVerified ?? false,
      isMobileVerified: user.isMobileVerified ?? false,
      department: user.department ?? null,
      year: user.year ?? null,
      createdAt: user.createdAt ?? new Date(),
      updatedAt: user.updatedAt ?? new Date(),
    };
    this.users.push(created);
    return created;
  }

  async updateUserProfile(userId: number, profile: CohortScope): Promise<User> {
    const user = this.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error("User not found");
    }

    user.department = profile.department;
    user.year = profile.year;
    user.updatedAt = new Date();
    return user;
  }

  async updateUserIdentityProfile(userId: number, patch: Partial<InsertUser>): Promise<User> {
    const user = this.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error("User not found");
    }

    Object.assign(user, patch);
    user.updatedAt = new Date();
    return user;
  }

  async updateUserPassword(userId: number, passwordHash: string): Promise<User> {
    return this.updateUserIdentityProfile(userId, { password: passwordHash });
  }

  async createNote(note: InsertNote & { userId: number }): Promise<Note> {
    const created: Note = {
      id: this.nextNoteId++,
      createdAt: new Date(),
      description: note.description ?? null,
      fileName: note.fileName,
      fileUrl: note.fileUrl,
      semester: note.semester,
      subject: note.subject,
      title: note.title,
      userId: note.userId,
    };
    this.notes.push(created);
    return created;
  }

  async deleteNote(noteId: number): Promise<Note | undefined> {
    const existingIndex = this.notes.findIndex((n) => n.id === noteId);
    if (existingIndex < 0) return undefined;

    const [deletedNote] = this.notes.splice(existingIndex, 1);
    this.downloads = this.downloads.filter((d) => d.noteId !== noteId);
    return deletedNote;
  }

  async getNotes(
    scope: CohortScope,
    search?: string,
  ): Promise<(Note & { author: string; authorBranch: string | null; authorYear: number | null })[]> {
    const searchNormalized = search?.trim().toLowerCase();

    const filteredByCohort = this.notes.filter((note) => {
      const author = this.users.find((u) => u.id === note.userId);
      return author?.department === scope.department && author?.year === scope.year;
    });

    const filtered = searchNormalized
      ? filteredByCohort.filter((note) => {
          const author = this.users.find((u) => u.id === note.userId)?.username || "Unknown";
          const haystacks = [
            note.title,
            note.subject,
            note.description ?? "",
            note.semester,
            author,
          ]
            .join(" ")
            .toLowerCase();
          return haystacks.includes(searchNormalized);
        })
      : filteredByCohort.slice();

    const results = filtered
      .slice()
      .sort(
        (a, b) =>
          (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0),
      )
      .map((note) => ({
        ...note,
        author: this.users.find((u) => u.id === note.userId)?.username || "Unknown",
        authorBranch: this.users.find((u) => u.id === note.userId)?.department || null,
        authorYear: this.users.find((u) => u.id === note.userId)?.year || null,
      }));

    return results;
  }

  async getAllNotes(search?: string): Promise<(Note & { author: string; authorBranch: string | null; authorYear: number | null })[]> {
    const searchNormalized = search?.trim().toLowerCase();

    const filtered = searchNormalized
      ? this.notes.filter((note) => {
          const author = this.users.find((u) => u.id === note.userId)?.username || "Unknown";
          const haystacks = [
            note.title,
            note.subject,
            note.description ?? "",
            note.semester,
            author,
          ]
            .join(" ")
            .toLowerCase();
          return haystacks.includes(searchNormalized);
        })
      : this.notes.slice();

    return filtered
      .slice()
      .sort(
        (a, b) =>
          (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0),
      )
      .map((note) => ({
        ...note,
        author: this.users.find((u) => u.id === note.userId)?.username || "Unknown",
        authorBranch: this.users.find((u) => u.id === note.userId)?.department || null,
        authorYear: this.users.find((u) => u.id === note.userId)?.year || null,
      }));
  }

  async getNotesByDate(
    scope: CohortScope,
    date: string,
    search?: string,
  ): Promise<(Note & { author: string; authorBranch: string | null; authorYear: number | null })[]> {
    const filtered = await this.getNotes(scope, search);
    return filtered.filter((note) => {
      const createdAt = note.createdAt ? new Date(note.createdAt) : new Date(0);
      const noteDate = `${createdAt.getFullYear()}-${String(
        createdAt.getMonth() + 1,
      ).padStart(2, "0")}-${String(createdAt.getDate()).padStart(2, "0")}`;
      return noteDate === date;
    });
  }

  async getNote(
    id: number,
    scope: CohortScope,
  ): Promise<(Note & { author: string; authorBranch: string | null; authorYear: number | null }) | undefined> {
    const note = this.notes.find((n) => n.id === id);
    if (!note) return undefined;
    const authorUser = this.users.find((u) => u.id === note.userId);
    if (
      authorUser?.department !== scope.department ||
      authorUser?.year !== scope.year
    ) {
      return undefined;
    }
    return {
      ...note,
      author: this.users.find((u) => u.id === note.userId)?.username || "Unknown",
        authorBranch: this.users.find((u) => u.id === note.userId)?.department || null,
        authorYear: this.users.find((u) => u.id === note.userId)?.year || null,
    };
  }

  async getNoteAny(id: number): Promise<(Note & { author: string; authorBranch: string | null; authorYear: number | null }) | undefined> {
    const note = this.notes.find((n) => n.id === id);
    if (!note) return undefined;
    return {
      ...note,
      author: this.users.find((u) => u.id === note.userId)?.username || "Unknown",
        authorBranch: this.users.find((u) => u.id === note.userId)?.department || null,
        authorYear: this.users.find((u) => u.id === note.userId)?.year || null,
    };
  }

  async getMyUploads(userId: number): Promise<(Note & { author: string; authorBranch: string | null; authorYear: number | null })[]> {
    const authorUser = this.users.find((u) => u.id === userId);
    const author = authorUser?.username || "Unknown";
    const authorBranch = authorUser?.department || null;
    const authorYear = authorUser?.year || null;
    return this.notes
      .filter((n) => n.userId === userId)
      .slice()
      .sort(
        (a, b) =>
          (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0),
      )
      .map((note) => ({ ...note, author, authorBranch, authorYear }));
  }

  async getMyDownloads(
    userId: number,
  ): Promise<(Note & { author: string; downloadedAt: Date | null })[]> {
    const userDownloads = this.downloads
      .filter((d) => d.userId === userId)
      .slice()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return userDownloads
      .map((d) => {
        const note = this.notes.find((n) => n.id === d.noteId);
        if (!note) return undefined;
        return {
          ...note,
          author: this.users.find((u) => u.id === note.userId)?.username || "Unknown",
        authorBranch: this.users.find((u) => u.id === note.userId)?.department || null,
        authorYear: this.users.find((u) => u.id === note.userId)?.year || null,
          downloadedAt: d.createdAt,
        };
      })
      .filter(Boolean) as (Note & { author: string; downloadedAt: Date | null })[];
  }

  async recordDownload(userId: number, noteId: number): Promise<void> {
    const existing = this.downloads.find(
      (d) => d.userId === userId && d.noteId === noteId,
    );
    if (existing) return;

    this.downloads.push({
      id: this.nextDownloadId++,
      userId,
      noteId,
      createdAt: new Date(),
    });
  }
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return undefined;
}

function databaseUrlHasSslOptions(databaseUrl: string): boolean {
  try {
    const url = new URL(databaseUrl);
    // node-postgres parses these from the connection string and may override `ssl` in config.
    return (
      url.searchParams.has("sslmode") ||
      url.searchParams.has("sslrootcert") ||
      url.searchParams.has("sslcert") ||
      url.searchParams.has("sslkey")
    );
  } catch {
    return false;
  }
}

function resolvePgSsl():
  | boolean
  | {
      rejectUnauthorized?: boolean;
      ca?: string;
    }
  | undefined {
  const raw = process.env.PG_SSL?.trim();
  if (!raw) return undefined;

  const normalized = raw.toLowerCase();
  if (["0", "false", "disable", "disabled", "off"].includes(normalized)) {
    return undefined;
  }

  let rejectUnauthorized: boolean | undefined =
    normalized === "require" || normalized === "allow" || normalized === "prefer"
      ? false
      : normalized === "verify-full" || normalized === "verify-ca"
        ? true
        : true;

  const overrideRejectUnauthorized = parseBoolean(
    process.env.PG_SSL_REJECT_UNAUTHORIZED,
  );
  if (overrideRejectUnauthorized !== undefined) {
    rejectUnauthorized = overrideRejectUnauthorized;
  }

  let ca: string | undefined;
  const caFromEnv = process.env.PG_SSL_CA?.replace(/\\n/g, "\n").trim();
  if (caFromEnv) ca = caFromEnv;

  const caFile = process.env.PG_SSL_CA_FILE?.trim();
  if (caFile) {
    ca = fs.readFileSync(caFile, "utf8");
  }

  return { rejectUnauthorized, ...(ca ? { ca } : {}) };
}

function createPgPool(databaseUrl: string): pg.Pool {
  const sslFromUrl = databaseUrlHasSslOptions(databaseUrl);
  return new Pool({
    connectionString: databaseUrl,
    // If SSL is configured in DATABASE_URL (common for Neon/Supabase), don't pass `ssl` here.
    ssl: sslFromUrl ? undefined : resolvePgSsl(),
    max: Number.parseInt(process.env.PG_POOL_MAX || "10", 10),
    idleTimeoutMillis: Number.parseInt(process.env.PG_POOL_IDLE_MS || "30000", 10),
    connectionTimeoutMillis: Number.parseInt(
      process.env.PG_POOL_CONNECT_TIMEOUT_MS || "5000",
      10,
    ),
  });
}

function formatStorageInitError(err: unknown): string {
  if (!err || typeof err !== "object") return String(err);
  const maybe = err as { code?: unknown; message?: unknown; hostname?: unknown };
  const code = typeof maybe.code === "string" ? maybe.code : undefined;
  const hostname = typeof maybe.hostname === "string" ? maybe.hostname : undefined;
  const message = typeof maybe.message === "string" ? maybe.message : undefined;
  return [
    "Database connection failed",
    code ? `code=${code}` : undefined,
    hostname ? `host=${hostname}` : undefined,
    message ? `message=${message}` : undefined,
  ]
    .filter(Boolean)
    .join(" ");
}

export async function createStorage(): Promise<{
  storage: IStorage;
  mode: "database" | "memory";
}> {
  const isProduction = process.env.NODE_ENV === "production";
  const requireDatabase =
    isProduction || process.env.REQUIRE_DATABASE?.trim() === "true";

  try {
    const storage = await DatabaseStorage.create();
    return { storage, mode: "database" };
  } catch (err) {
    if (requireDatabase) {
      throw err;
    }

    console.warn(
      `${formatStorageInitError(err)}. Falling back to in-memory storage for development.`,
    );
    console.warn(
      "To use Postgres, fix DATABASE_URL/DNS (or set REQUIRE_DATABASE=true to fail fast).",
    );
    return { storage: new MemoryStorage(), mode: "memory" };
  }
}
