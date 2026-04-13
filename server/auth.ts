
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import { randomBytes, randomInt, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import type { IStorage } from "./storage";
import {
  authLoginSchema,
  authOtpRequestSchema,
  authOtpVerifySchema,
  authRegisterSchema,
  changePasswordSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  User,
} from "@shared/schema";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

function sanitizeUser(user: User) {
  return {
    id: user.id,
    username: user.username,
    nickName: user.nickName ?? user.username,
    role: user.role ?? "student",
    department: user.department ?? null,
    year: user.year ?? null,
  };
}

function getGoogleRedirectUri(req: Parameters<Parameters<Express["get"]>[1]>[0]) {
  const fromEnv = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (fromEnv) return fromEnv;
  const host = req.get("host");
  return `${req.protocol}://${host}/api/auth/google/callback`;
}

function normalizeIdentifier(raw: string): {
  kind: "email" | "phone" | "username";
  normalized: string;
  email?: string;
  phone?: string;
} {
  const trimmed = raw.trim();
  const emailCandidate = trimmed.toLowerCase();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailCandidate);
  if (isEmail) {
    return { kind: "email", normalized: emailCandidate, email: emailCandidate };
  }

  const phoneCandidate = trimmed.replace(/[()\s.-]/g, "");
  const isPhone = /^\+?\d{7,15}$/.test(phoneCandidate);
  if (isPhone) {
    return { kind: "phone", normalized: phoneCandidate, phone: phoneCandidate };
  }

  return { kind: "username", normalized: trimmed };
}

function normalizePhone(raw: string): string {
  return raw.trim().replace(/[()\s.-]/g, "");
}

function usernameBaseFromIdentifier(identifier: string) {
  const parsed = normalizeIdentifier(identifier);
  const baseRaw =
    parsed.kind === "email"
      ? parsed.normalized.split("@")[0]
      : parsed.kind === "phone"
        ? `user${parsed.normalized.replace(/\D/g, "").slice(-4)}`
        : parsed.normalized;

  const sanitized = baseRaw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);

  return sanitized.length >= 3 ? sanitized : "user";
}

async function generateUniqueUsername(storage: IStorage, identifier: string) {
  const base = usernameBaseFromIdentifier(identifier);
  let candidate = base;

  for (let i = 0; i < 8; i++) {
    const existing = await storage.getUserByUsername(candidate);
    if (!existing) return candidate;
    candidate = `${base}${randomInt(1000, 9999)}`.slice(0, 32);
  }

  return `${base}${randomBytes(3).toString("hex")}`.slice(0, 32);
}

export function setupAuth(app: Express, storage: IStorage) {
  const isProduction = app.get("env") === "production";
  const sessionMiddleware = createSessionMiddleware(storage, isProduction);

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  app.use(sessionMiddleware);
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "identifier", passwordField: "password" },
      async (identifier, password, done) => {
        const parsed = normalizeIdentifier(identifier);
        const trimmed = identifier.trim();
        const user =
          (await storage.getUserByIdentifier(parsed.normalized)) ||
          (parsed.normalized !== trimmed
            ? await storage.getUserByIdentifier(trimmed)
            : undefined);
      if (!user || !(await comparePasswords(password, user.password))) {
        return done(null, false);
      } else {
        return done(null, user);
      }
      },
    ),
  );

  passport.serializeUser((user, done) => done(null, (user as User).id));
  passport.deserializeUser(async (id: number, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const parsed = authRegisterSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
      }

      const input = parsed.data;

      let email = input.email;
      let mobileNumber = input.mobileNumber;

      if (input.identifier) {
        const normalized = normalizeIdentifier(input.identifier);
        if (normalized.kind === "username") {
          return res
            .status(400)
            .json({ message: "Please use a valid email or phone number" });
        }
        email = normalized.email ?? email;
        mobileNumber = normalized.phone ?? mobileNumber;
      }

      const normalizedEmail = email?.toLowerCase().trim();
      const normalizedMobile = mobileNumber ? normalizePhone(mobileNumber) : undefined;

      if (!normalizedEmail && !normalizedMobile) {
        return res.status(400).json({ message: "Provide at least one contact method" });
      }

      if (normalizedEmail) {
        const existing = await storage.getUserByEmail(normalizedEmail);
        if (existing) return res.status(400).json({ message: "Account already exists" });
      }

      if (normalizedMobile) {
        const existing = await storage.getUserByMobile(normalizedMobile);
        if (existing) return res.status(400).json({ message: "Account already exists" });
      }

      const hashedPassword = await hashPassword(parsed.data.password);
      const username = await generateUniqueUsername(
        storage,
        normalizedEmail ?? normalizedMobile ?? "user",
      );

      const nickName =
        input.nickName?.trim() ||
        (normalizedEmail ? normalizedEmail.split("@")[0] : undefined) ||
        (normalizedMobile
          ? `user${normalizedMobile.replace(/\D/g, "").slice(-4)}`
          : undefined) ||
        username;

      const role = input.role ?? "student";
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        fullName: null,
        nickName,
        email: normalizedEmail,
        mobileNumber: normalizedMobile,
        phone: null,
        role,
        isEmailVerified: Boolean(normalizedEmail),
        isMobileVerified: Boolean(normalizedMobile),
        department: input.department ?? null,
        year: input.year ?? null,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(sanitizeUser(user));
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/login", passport.authenticate("local"), (req, res) => {
    res.status(200).json(sanitizeUser(req.user as User));
  });

  app.get("/api/auth/google/start", (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    if (!clientId || !clientSecret) {
      return res.status(500).json({ message: "Google OAuth is not configured" });
    }

    const state = randomBytes(16).toString("hex");
    req.session.googleOAuthState = state;

    const redirectUri = getGoogleRedirectUri(req);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      include_granted_scopes: "true",
      prompt: "select_account",
      state,
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  app.get("/api/auth/google/callback", async (req, res, next) => {
    try {
      const code = typeof req.query.code === "string" ? req.query.code : undefined;
      const state = typeof req.query.state === "string" ? req.query.state : undefined;
      const error = typeof req.query.error === "string" ? req.query.error : undefined;

      if (error) {
        req.session.googleOAuthState = undefined;
        return res.redirect("/auth");
      }

      if (!code || !state) {
        return res.redirect("/auth");
      }

      if (!req.session.googleOAuthState || req.session.googleOAuthState !== state) {
        req.session.googleOAuthState = undefined;
        return res.redirect("/auth");
      }
      req.session.googleOAuthState = undefined;

      const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
      if (!clientId || !clientSecret) {
        return res.status(500).json({ message: "Google OAuth is not configured" });
      }

      const redirectUri = getGoogleRedirectUri(req);

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        console.error("Google OAuth token exchange failed", await tokenRes.text());
        return res.redirect("/auth");
      }

      const tokenJson = (await tokenRes.json()) as {
        access_token?: unknown;
      };

      const accessToken =
        typeof tokenJson.access_token === "string" ? tokenJson.access_token : undefined;
      if (!accessToken) {
        return res.redirect("/auth");
      }

      const userInfoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userInfoRes.ok) {
        console.error("Google OAuth userinfo fetch failed", await userInfoRes.text());
        return res.redirect("/auth");
      }

      const userInfo = (await userInfoRes.json()) as {
        email?: unknown;
        email_verified?: unknown;
        sub?: unknown;
      };

      const email =
        typeof userInfo.email === "string" ? userInfo.email.toLowerCase().trim() : undefined;
      const emailVerified =
        typeof userInfo.email_verified === "boolean" ? userInfo.email_verified : undefined;

      if (!email || emailVerified === false) {
        return res.redirect("/auth");
      }

      let user = await storage.getUserByIdentifier(email);
      if (!user) {
        const username = await generateUniqueUsername(storage, email);
        const randomPassword = randomBytes(32).toString("hex");
        const hashedPassword = await hashPassword(randomPassword);

        user = await storage.createUser({
          username,
          fullName: null,
          nickName: email.split("@")[0] || username,
          email,
          phone: null,
          mobileNumber: null,
          role: "student",
          isEmailVerified: true,
          isMobileVerified: false,
          password: hashedPassword,
        });
      }

      req.login(user, (err) => {
        if (err) return next(err);
        return res.redirect("/");
      });
    } catch (err) {
      next(err);
    }
  });

  const OTP_TTL_MS = 10 * 60 * 1000;
  const OTP_COOLDOWN_MS = 30 * 1000;

  app.post("/api/login/code/request", async (req, res) => {
    const parsed = authOtpRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    const normalized = normalizeIdentifier(parsed.data.identifier);
    if (normalized.kind === "username") {
      return res
        .status(400)
        .json({ message: "Please use a valid email or phone number" });
    }

    const user = await storage.getUserByIdentifier(normalized.normalized);
    if (!user) {
      return res.status(404).json({ message: "Account not found" });
    }

    const now = Date.now();
    const existing = req.session.loginOtp;
    if (
      existing &&
      existing.identifier === normalized.normalized &&
      now - existing.lastSentAt < OTP_COOLDOWN_MS
    ) {
      return res.status(429).json({ message: "Please wait before requesting another code" });
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = await hashPassword(code);

    req.session.loginOtp = {
      identifier: normalized.normalized,
      codeHash,
      expiresAt: now + OTP_TTL_MS,
      lastSentAt: now,
    };

    // Provider integration placeholder (email/SMS). For now, log in dev and return the code in dev responses.
    if (!isProduction) {
      console.log(`[auth] login code for ${normalized.normalized}: ${code}`);
      return res.status(200).json({ message: "Code sent", devCode: code });
    }

    return res.status(200).json({ message: "Code sent" });
  });

  app.post("/api/login/code/verify", async (req, res, next) => {
    try {
      const parsed = authOtpVerifySchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
      }

      const normalized = normalizeIdentifier(parsed.data.identifier);
      if (normalized.kind === "username") {
        return res
          .status(400)
          .json({ message: "Please use a valid email or phone number" });
      }

      const otp = req.session.loginOtp;
      if (!otp || otp.identifier !== normalized.normalized) {
        return res.status(401).json({ message: "No code requested" });
      }
      if (Date.now() > otp.expiresAt) {
        req.session.loginOtp = undefined;
        return res.status(401).json({ message: "Code expired" });
      }

      const ok = await comparePasswords(parsed.data.code, otp.codeHash);
      if (!ok) {
        return res.status(401).json({ message: "Invalid code" });
      }

      const user = await storage.getUserByIdentifier(normalized.normalized);
      if (!user) {
        req.session.loginOtp = undefined;
        return res.status(404).json({ message: "Account not found" });
      }

      req.session.loginOtp = undefined;
      req.login(user, (err) => {
        if (err) return next(err);
        return res.status(200).json(sanitizeUser(user));
      });
    } catch (err) {
      next(err);
    }
  });

  // Forgot password (session-based OTP, dev-friendly).
  app.post("/api/password/reset/request", async (req, res) => {
    const parsed = passwordResetRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
    }

    const normalized = normalizeIdentifier(parsed.data.identifier);
    if (normalized.kind === "username") {
      return res.status(400).json({ message: "Please use a valid email or phone number" });
    }

    const user = await storage.getUserByIdentifier(normalized.normalized);
    if (!user) {
      return res.status(404).json({ message: "Account not found" });
    }

    const now = Date.now();
    const existing = req.session.passwordResetOtp;
    if (
      existing &&
      existing.identifier === normalized.normalized &&
      now - existing.lastSentAt < OTP_COOLDOWN_MS
    ) {
      return res.status(429).json({ message: "Please wait before requesting another code" });
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const codeHash = await hashPassword(code);

    req.session.passwordResetOtp = {
      identifier: normalized.normalized,
      codeHash,
      expiresAt: now + OTP_TTL_MS,
      lastSentAt: now,
    };

    if (!isProduction) {
      console.log(`[auth] password reset code for ${normalized.normalized}: ${code}`);
      return res.status(200).json({ message: "Code sent", devCode: code });
    }

    return res.status(200).json({ message: "Code sent" });
  });

  app.post("/api/password/reset/confirm", async (req, res, next) => {
    try {
      const parsed = passwordResetConfirmSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
      }

      const normalized = normalizeIdentifier(parsed.data.identifier);
      if (normalized.kind === "username") {
        return res.status(400).json({ message: "Please use a valid email or phone number" });
      }

      const otp = req.session.passwordResetOtp;
      if (!otp || otp.identifier !== normalized.normalized) {
        return res.status(401).json({ message: "No reset code requested" });
      }
      if (Date.now() > otp.expiresAt) {
        req.session.passwordResetOtp = undefined;
        return res.status(401).json({ message: "Code expired" });
      }

      const ok = await comparePasswords(parsed.data.code, otp.codeHash);
      if (!ok) {
        return res.status(401).json({ message: "Invalid code" });
      }

      const user = await storage.getUserByIdentifier(normalized.normalized);
      if (!user) {
        req.session.passwordResetOtp = undefined;
        return res.status(404).json({ message: "Account not found" });
      }

      const hashed = await hashPassword(parsed.data.newPassword);
      await storage.updateUserPassword(user.id, hashed);
      req.session.passwordResetOtp = undefined;

      return res.status(200).json({ message: "Password updated" });
    } catch (err) {
      next(err);
    }
  });

  app.put("/api/user/password", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.sendStatus(401);

      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.issues[0]?.message ?? "Invalid input" });
      }

      const user = await storage.getUser(req.user.id);
      if (!user) return res.sendStatus(401);

      const ok = await comparePasswords(parsed.data.currentPassword, user.password);
      if (!ok) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      const hashed = await hashPassword(parsed.data.newPassword);
      await storage.updateUserPassword(req.user.id, hashed);
      return res.status(200).json({ message: "Password updated" });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.status(200).json({ message: "ok" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(sanitizeUser(req.user as User));
  });

  return { sessionMiddleware };
}

export function createSessionMiddleware(storage: IStorage, isProduction: boolean) {
  if (isProduction && !process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be set in production");
  }

  const sessionSettings: session.SessionOptions = {
    name: "notehub.sid",
    secret: process.env.SESSION_SECRET || "dev-only-session-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProduction ? "auto" : false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  };

  return session(sessionSettings);
}
