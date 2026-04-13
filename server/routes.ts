
import type { Express } from "express";
import { createServer, type Server } from "http";
import { comparePasswords, hashPassword, setupAuth } from "./auth";
import type { IStorage } from "./storage";
import { api } from "@shared/routes";
import { seed } from "./seed";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { validateBody } from "./middleware/validate";
import { registerStudyRoutes } from "./studyHub";

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

function sanitizeFilename(originalName: string) {
  const base = path.basename(originalName);
  const safe = base.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 160);
  return safe || "upload";
}

function getUploadFilePath(fileUrl: string): string | null {
  const filename = path.basename(fileUrl);
  if (!filename || filename === "." || filename === path.basename(uploadDir)) {
    return null;
  }

  return path.join(uploadDir, filename);
}

async function deleteUploadedFile(fileUrl: string) {
  const filePath = getUploadFilePath(fileUrl);
  if (!filePath) return;

  try {
    await fs.promises.unlink(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Failed to delete uploaded file:", error);
    }
  }
}

const allowedUpload = new Set([".pdf", ".doc", ".docx", ".ppt", ".pptx"]);
const allowedMime = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

// Configure multer for file storage
const storageConfig = multer.diskStorage({
  destination: function (_req: any, _file: any, cb: any) {
    cb(null, uploadDir);
  },
  filename: function (_req: any, file: any, cb: any) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + sanitizeFilename(file.originalname));
  }
});

const upload = multer({ 
  storage: storageConfig,
  fileFilter: (_req: any, file: any, cb: any) => {
    const ext = path.extname(String(file.originalname || "")).toLowerCase();
    const mimetype = String(file.mimetype || "").toLowerCase();

    const okExt = allowedUpload.has(ext);
    const okMime = allowedMime.has(mimetype);

    if (!okExt || !okMime) {
      return cb(new Error("Unsupported file type"));
    }

    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

function getCohortScope(req: any): { department: string; year: number } | null {
  const departmentRaw = req?.user?.department;
  const yearRaw = req?.user?.year;

  const department =
    typeof departmentRaw === "string" ? departmentRaw.trim() : undefined;
  const year = typeof yearRaw === "number" ? yearRaw : Number(yearRaw);

  if (!department) return null;
  if (!Number.isFinite(year) || year < 1) return null;

  return { department, year };
}

function normalizePhone(raw: string): string {
  return raw.trim().replace(/[()\s.-]/g, "");
}

function sanitizeUserSummary(user: any) {
  return {
    id: user.id,
    username: user.username,
    nickName: user.nickName ?? user.username,
    role: user.role ?? "student",
    department: user.department ?? null,
    year: user.year ?? null,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
  storage: IStorage,
): Promise<Server> {
  // Set up auth routes and middleware
  setupAuth(app, storage);
  registerStudyRoutes(app);

  // Serve uploaded files statically
  app.use(
    "/uploads",
    express.static(uploadDir, {
      setHeaders: (res) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "private, max-age=3600");
      },
    }),
  );

  // Seed database in development only (never seed default credentials in production).
  if (app.get("env") !== "production" && process.env.SEED_ON_START !== "false") {
    await seed(storage);
  }

  // --- API Routes ---

  app.patch(api.auth.updateProfile.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const parsed = api.auth.updateProfile.input.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    const department = parsed.data.department.trim();
    const year = parsed.data.year;

    const user = await storage.updateUserProfile(req.user.id, { department, year });
    return res.status(200).json(sanitizeUserSummary(user));
  });

  app.get(api.user.profile.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);

    const user = await storage.getUser(req.user.id);
    if (!user) return res.sendStatus(401);

    return res.status(200).json({
      id: user.id,
      username: user.username,
      fullName: user.fullName ?? null,
      nickName: user.nickName ?? user.username,
      email: user.email ?? null,
      mobileNumber: user.mobileNumber ?? user.phone ?? null,
      role: user.role ?? "student",
      isEmailVerified: Boolean(user.email) ? Boolean(user.isEmailVerified) : false,
      isMobileVerified: Boolean(user.mobileNumber ?? user.phone)
        ? Boolean(user.isMobileVerified)
        : false,
      department: user.department ?? null,
      year: user.year ?? null,
      createdAt: user.createdAt ? user.createdAt.toISOString() : null,
      updatedAt: user.updatedAt ? user.updatedAt.toISOString() : null,
    });
  });

  app.put(
    api.user.updateProfile.path,
    validateBody(api.user.updateProfile.input),
    async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const input = res.locals.body as z.infer<typeof api.user.updateProfile.input>;

    const user = await storage.getUser(req.user.id);
    if (!user) return res.sendStatus(401);

    const patch: Record<string, unknown> = {};

    if (input.fullName !== undefined) {
      patch.fullName = input.fullName;
    }

    if (input.nickName !== undefined) {
      patch.nickName = input.nickName;
    }

    if (input.role !== undefined) {
      patch.role = input.role;
    }

    // Email updates
    if (input.email !== undefined) {
      const nextEmail = input.email;
      const normalizedEmail = typeof nextEmail === "string" ? nextEmail.toLowerCase().trim() : null;

      if (normalizedEmail) {
        const existing = await storage.getUserByEmail(normalizedEmail);
        if (existing && existing.id !== user.id) {
          return res.status(400).json({ message: "Email is already in use" });
        }
      }

      const wasEmail = user.email?.toLowerCase().trim() ?? null;
      patch.email = normalizedEmail;
      if (normalizedEmail !== wasEmail) {
        patch.isEmailVerified = false;
      }
    }

    // Mobile updates (canonical stored in mobile_number)
    if (input.mobileNumber !== undefined) {
      const nextMobileRaw = input.mobileNumber;
      const normalizedMobile =
        typeof nextMobileRaw === "string" ? normalizePhone(nextMobileRaw) : null;

      if (normalizedMobile) {
        const existing = await storage.getUserByMobile(normalizedMobile);
        if (existing && existing.id !== user.id) {
          return res.status(400).json({ message: "Mobile number is already in use" });
        }
      }

      const wasMobile = user.mobileNumber ?? null;
      patch.mobileNumber = normalizedMobile;
      if (normalizedMobile !== wasMobile) {
        patch.isMobileVerified = false;
      }
    }

    // Enforce "at least one verified identity" while keeping legacy users working.
    const emailNext =
      (patch.email as string | null | undefined) !== undefined
        ? (patch.email as string | null)
        : (user.email ?? null);
    const isEmailVerifiedNext =
      (patch.isEmailVerified as boolean | undefined) !== undefined
        ? Boolean(patch.isEmailVerified)
        : Boolean(user.isEmailVerified);

    const mobileNext =
      (patch.mobileNumber as string | null | undefined) !== undefined
        ? (patch.mobileNumber as string | null)
        : (user.mobileNumber ?? null);
    const isMobileVerifiedNext =
      (patch.isMobileVerified as boolean | undefined) !== undefined
        ? Boolean(patch.isMobileVerified)
        : Boolean(user.isMobileVerified);

    const hasAnyContact = Boolean(emailNext || mobileNext || user.phone);
    const hasVerifiedIdentity =
      (Boolean(emailNext) && isEmailVerifiedNext) ||
      (Boolean(mobileNext || user.phone) && isMobileVerifiedNext) ||
      !hasAnyContact; // legacy accounts (username-only) remain allowed

    if (hasAnyContact && !hasVerifiedIdentity) {
      return res.status(400).json({
        message:
          "You must keep at least one verified identity (verify email or mobile before changing the only verified one).",
      });
    }

    const updated = await storage.updateUserIdentityProfile(req.user.id, patch as any);

    return res.status(200).json({
      id: updated.id,
      username: updated.username,
      fullName: updated.fullName ?? null,
      nickName: updated.nickName ?? updated.username,
      email: updated.email ?? null,
      mobileNumber: updated.mobileNumber ?? updated.phone ?? null,
      role: updated.role ?? "student",
      isEmailVerified: Boolean(updated.email) ? Boolean(updated.isEmailVerified) : false,
      isMobileVerified: Boolean(updated.mobileNumber ?? updated.phone)
        ? Boolean(updated.isMobileVerified)
        : false,
      department: updated.department ?? null,
      year: updated.year ?? null,
      createdAt: updated.createdAt ? updated.createdAt.toISOString() : null,
      updatedAt: updated.updatedAt ? updated.updatedAt.toISOString() : null,
    });
    },
  );

  const VERIFY_TTL_MS = 10 * 60 * 1000;
  const VERIFY_COOLDOWN_MS = 30 * 1000;

  app.post(
    api.user.verifyEmail.path,
    validateBody(api.user.verifyEmail.input),
    async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const input = res.locals.body as z.infer<typeof api.user.verifyEmail.input>;

    const user = await storage.getUser(req.user.id);
    if (!user) return res.sendStatus(401);

    const email = input.email.toLowerCase().trim();
    if (!user.email || user.email.toLowerCase().trim() !== email) {
      return res.status(400).json({ message: "Save this email on your profile first" });
    }

    const now = Date.now();
    const existing = req.session.verifyEmailOtp;
    if (existing && existing.email === email && now - existing.lastSentAt < VERIFY_COOLDOWN_MS) {
      return res.status(429).json({ message: "Please wait before requesting another code" });
    }

    if (!input.code) {
      const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
      const codeHash = await hashPassword(code);
      req.session.verifyEmailOtp = {
        email,
        codeHash,
        expiresAt: now + VERIFY_TTL_MS,
        lastSentAt: now,
      };

      if (app.get("env") !== "production") {
        console.log(`[verify] email code for ${email}: ${code}`);
        return res.status(200).json({ message: "Code sent", devCode: code });
      }

      return res.status(200).json({ message: "Code sent" });
    }

    const otp = req.session.verifyEmailOtp;
    if (!otp || otp.email !== email) {
      return res.status(401).json({ message: "No code requested" });
    }
    if (Date.now() > otp.expiresAt) {
      req.session.verifyEmailOtp = undefined;
      return res.status(401).json({ message: "Code expired" });
    }

    const ok = await comparePasswords(input.code, otp.codeHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid code" });
    }

    await storage.updateUserIdentityProfile(req.user.id, { isEmailVerified: true } as any);
    req.session.verifyEmailOtp = undefined;

    return res.status(200).json({ message: "Email verified" });
    },
  );

  app.post(
    api.user.verifyMobile.path,
    validateBody(api.user.verifyMobile.input),
    async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const input = res.locals.body as z.infer<typeof api.user.verifyMobile.input>;

    const user = await storage.getUser(req.user.id);
    if (!user) return res.sendStatus(401);

    const mobileNumber = normalizePhone(input.mobileNumber);
    const effectiveMobile = user.mobileNumber ?? user.phone ?? null;
    if (!effectiveMobile || normalizePhone(effectiveMobile) !== mobileNumber) {
      return res.status(400).json({ message: "Save this mobile number on your profile first" });
    }

    const now = Date.now();
    const existing = req.session.verifyMobileOtp;
    if (
      existing &&
      existing.mobileNumber === mobileNumber &&
      now - existing.lastSentAt < VERIFY_COOLDOWN_MS
    ) {
      return res.status(429).json({ message: "Please wait before requesting another code" });
    }

    if (!input.code) {
      const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
      const codeHash = await hashPassword(code);
      req.session.verifyMobileOtp = {
        mobileNumber,
        codeHash,
        expiresAt: now + VERIFY_TTL_MS,
        lastSentAt: now,
      };

      if (app.get("env") !== "production") {
        console.log(`[verify] mobile code for ${mobileNumber}: ${code}`);
        return res.status(200).json({ message: "Code sent", devCode: code });
      }

      return res.status(200).json({ message: "Code sent" });
    }

    const otp = req.session.verifyMobileOtp;
    if (!otp || otp.mobileNumber !== mobileNumber) {
      return res.status(401).json({ message: "No code requested" });
    }
    if (Date.now() > otp.expiresAt) {
      req.session.verifyMobileOtp = undefined;
      return res.status(401).json({ message: "Code expired" });
    }

    const ok = await comparePasswords(input.code, otp.codeHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid code" });
    }

    await storage.updateUserIdentityProfile(req.user.id, { isMobileVerified: true } as any);
    req.session.verifyMobileOtp = undefined;

    return res.status(200).json({ message: "Mobile verified" });
    },
  );

  app.get(api.notes.list.path, async (req, res) => {
    // Only logged in users can view notes
    if (!req.isAuthenticated()) return res.status(401).send();

    const allRaw = req.query.all;
    const all =
      allRaw === "1" ||
      allRaw === "true" ||
      allRaw === "yes" ||
      allRaw === "on";

    const scope = getCohortScope(req);
    if (!all && !scope) {
      return res.status(400).json({
        message: "Please complete your profile (department and year) to view notes.",
      });
    }

    const searchRaw = req.query.search as string | undefined;
    const search = searchRaw && searchRaw.length > 200 ? searchRaw.slice(0, 200) : searchRaw;

    if (all) {
      const notes = await storage.getAllNotes(search);
      return res.json(notes);
    }

    const notes = await storage.getNotes(scope!, search);
    return res.json(notes);
  });

  app.get(api.notes.all.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();

    const searchRaw = req.query.search as string | undefined;
    const search = searchRaw && searchRaw.length > 200 ? searchRaw.slice(0, 200) : searchRaw;
    const notes = await storage.getAllNotes(search);
    return res.json(notes);
  });

  app.get(api.notes.byDate.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();

    const scope = getCohortScope(req);
    if (!scope) {
      return res.status(400).json({
        message: "Please complete your profile (department and year) to view notes.",
      });
    }

    const dateRaw = req.query.date as string | undefined;
    const date = typeof dateRaw === "string" ? dateRaw.trim() : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "Invalid date. Use YYYY-MM-DD." });
    }

    const searchRaw = req.query.search as string | undefined;
    const search = searchRaw && searchRaw.length > 200 ? searchRaw.slice(0, 200) : searchRaw;

    const notes = await storage.getNotesByDate(scope, date, search);
    return res.json(notes);
  });

  app.get(api.notes.get.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();

    const scope = getCohortScope(req);
    if (!scope) {
      return res.status(400).json({
        message: "Please complete your profile (department and year) to view notes.",
      });
    }
    
    const noteId = Number(req.params.id);
    if (!Number.isFinite(noteId)) {
      return res.status(400).json({ message: "Invalid note id" });
    }

    const note = await storage.getNote(noteId, scope);
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }
    res.json(note);
  });

  app.post(api.notes.create.path, upload.single('file'), async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    if (!req.file) {
      return res.status(400).json({ message: "File is required" });
    }

    if (!getCohortScope(req)) {
      return res.status(400).json({
        message: "Please complete your profile (department and year) before uploading notes.",
      });
    }

    try {
      const bodySchema = z.object({
        title: z.string().trim().min(1).max(120),
        subject: z.string().trim().min(1).max(24),
        semester: z.string().trim().min(1).max(32),
        description: z.string().trim().max(2000).optional(),
      });

      const parsed = bodySchema.parse({
        title: req.body.title,
        subject: req.body.subject,
        semester: req.body.semester,
        description: req.body.description,
      });

      const input = {
        ...parsed,
        fileName: sanitizeFilename(req.file.originalname),
        fileUrl: `/uploads/${req.file.filename}`,
      };
      
      const note = await storage.createNote({
        ...input,
        userId: req.user!.id,
      });

      res.status(201).json(note);
    } catch (err) {
      console.error("Upload error:", err);
      res.status(400).json({ message: "Invalid input data" });
    }
  });

  app.delete(api.notes.remove.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();

    const noteId = Number(req.params.id);
    if (!Number.isFinite(noteId)) {
      return res.status(400).json({ message: "Invalid note id" });
    }

    const note = await storage.getNoteAny(noteId);
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }

    if (note.userId !== req.user.id) {
      return res.status(403).json({ message: "You can only delete your own notes" });
    }

    const deletedNote = await storage.deleteNote(noteId);
    if (!deletedNote) {
      return res.status(404).json({ message: "Note not found" });
    }

    await deleteUploadedFile(deletedNote.fileUrl);
    return res.sendStatus(204);
  });

  app.get(api.me.uploads.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const uploads = await storage.getMyUploads(req.user.id);
    res.json(uploads);
  });

  app.get(api.me.downloads.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    const downloads = await storage.getMyDownloads(req.user.id);
    res.json(downloads);
  });

  app.post(api.notes.download.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();

    const noteId = Number(req.params.id);
    if (!Number.isFinite(noteId)) {
      return res.status(400).json({ message: "Invalid note id" });
    }

    const note = await storage.getNoteAny(noteId);
    if (!note) {
      return res.status(404).json({ message: "Note not found" });
    }

    await storage.recordDownload(req.user.id, noteId);
    return res.sendStatus(204);
  });

  return httpServer;
}
