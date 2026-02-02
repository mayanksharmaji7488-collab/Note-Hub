
import { db } from "./db";
import { notes, users, type User, type InsertUser, type Note, type InsertNote } from "@shared/schema";
import { eq, like, or, desc } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  createNote(note: InsertNote & { userId: number }): Promise<Note>;
  getNotes(search?: string): Promise<(Note & { author: string })[]>;
  getNote(id: number): Promise<(Note & { author: string }) | undefined>;
  
  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createNote(note: InsertNote & { userId: number }): Promise<Note> {
    const [newNote] = await db.insert(notes).values(note).returning();
    return newNote;
  }

  async getNotes(search?: string): Promise<(Note & { author: string })[]> {
    const query = db
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
      })
      .from(notes)
      .leftJoin(users, eq(notes.userId, users.id))
      .orderBy(desc(notes.createdAt));

    if (search) {
      const searchLower = `%${search.toLowerCase()}%`;
      query.where(
        or(
          like(notes.title, searchLower),
          like(notes.subject, searchLower),
          like(notes.description, searchLower)
        )
      );
    }

    // execute query
    const results = await query;
    
    // map null authors to "Unknown" if user deleted
    return results.map(row => ({
      ...row,
      author: row.author || "Unknown"
    }));
  }

  async getNote(id: number): Promise<(Note & { author: string }) | undefined> {
    const [note] = await db
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
      })
      .from(notes)
      .leftJoin(users, eq(notes.userId, users.id))
      .where(eq(notes.id, id));

    if (!note) return undefined;

    return {
      ...note,
      author: note.author || "Unknown"
    };
  }
}

export const storage = new DatabaseStorage();
