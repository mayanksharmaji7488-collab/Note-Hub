import type { NextFunction, Request, Response } from "express";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  key?: (req: Request) => string;
  message?: string;
};

type Counter = { count: number; resetAt: number };

export function createRateLimiter(options: RateLimitOptions) {
  const store = new Map<string, Counter>();
  const keyFn = options.key ?? ((req) => req.ip || "unknown");
  const message = options.message ?? "Too many requests";

  return function rateLimiter(req: Request, res: Response, next: NextFunction) {
    const now = Date.now();
    const key = keyFn(req);
    const existing = store.get(key);

    if (!existing || existing.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + options.windowMs });
    } else {
      existing.count += 1;
    }

    const current = store.get(key)!;
    const remaining = Math.max(0, options.max - current.count);
    const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);

    res.setHeader("X-RateLimit-Limit", String(options.max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(current.resetAt));

    if (current.count > options.max) {
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ message });
    }

    // Best-effort cleanup to avoid unbounded memory growth.
    if (store.size > 10_000 && Math.random() < 0.01) {
      store.forEach((v, k) => {
        if (v.resetAt <= now) store.delete(k);
      });
    }

    next();
  };
}

export function securityHeaders(isProduction: boolean) {
  return function headers(_req: Request, res: Response, next: NextFunction) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Permissions-Policy",
      "camera=(self), microphone=(self), display-capture=(self), geolocation=(), payment=()",
    );

    // Keep CSP strict in production only (dev tooling frequently needs eval/inline).
    if (isProduction) {
      res.setHeader(
        "Content-Security-Policy",
        [
          "default-src 'self'",
          "base-uri 'self'",
          "frame-ancestors 'none'",
          "form-action 'self'",
          "img-src 'self' data: blob:",
          "font-src 'self' https://fonts.gstatic.com",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "script-src 'self'",
          "connect-src 'self'",
          "object-src 'none'",
          "upgrade-insecure-requests",
        ].join("; "),
      );
    }

    next();
  };
}

export function apiNoStore() {
  return function noStore(_req: Request, res: Response, next: NextFunction) {
    res.setHeader("Cache-Control", "no-store");
    next();
  };
}

export function originGuard(options: { enabled: boolean; allowedOrigins: string[] }) {
  const allowed = new Set(
    options.allowedOrigins.map((o) => o.trim()).filter(Boolean),
  );

  return function guard(req: Request, res: Response, next: NextFunction) {
    if (!options.enabled) return next();
    const method = req.method.toUpperCase();
    if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();

    const origin = req.headers.origin;
    if (!origin) {
      return res.status(403).json({ message: "Missing Origin header" });
    }

    if (!allowed.has(origin)) {
      return res.status(403).json({ message: "Blocked by origin policy" });
    }

    next();
  };
}

export function corsWithCredentials(options: {
  enabled: boolean;
  allowedOrigins: string[];
}) {
  const allowed = new Set(options.allowedOrigins.map((o) => o.trim()).filter(Boolean));

  return function cors(req: Request, res: Response, next: NextFunction) {
    const origin = req.headers.origin;
    if (!origin) return next();

    const allowOrigin = !options.enabled || allowed.has(origin);
    if (!allowOrigin) {
      if (req.method.toUpperCase() === "OPTIONS") {
        return res.status(403).json({ message: "Blocked by CORS policy" });
      }
      return next();
    }

    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");

    const requestHeaders = req.headers["access-control-request-headers"];
    res.setHeader(
      "Access-Control-Allow-Headers",
      typeof requestHeaders === "string" && requestHeaders.trim().length > 0
        ? requestHeaders
        : "Content-Type",
    );
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    res.setHeader("Access-Control-Max-Age", "600");

    if (req.method.toUpperCase() === "OPTIONS") {
      return res.sendStatus(204);
    }

    next();
  };
}
