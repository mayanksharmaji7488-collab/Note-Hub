import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import {
  apiNoStore,
  corsWithCredentials,
  createRateLimiter,
  originGuard,
  securityHeaders,
} from "./middleware/security";
import { createStorage } from "./storage";
import { createSessionMiddleware } from "./auth";
import { setupStudyHub } from "./studyHub";

const app = express();
const httpServer = createServer(app);
const isProduction = process.env.NODE_ENV === "production";

app.disable("x-powered-by");

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Middleware to capture raw body
app.use(
  express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false, limit: "100kb" }));

app.use(securityHeaders(isProduction));

// Basic API hardening. In production, set ALLOWED_ORIGINS to your deployed frontend origin(s).
const allowedOrigins =
  process.env.ALLOWED_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];
app.use(
  "/api",
  corsWithCredentials({
    enabled: isProduction && allowedOrigins.length > 0,
    allowedOrigins,
  }),
);
app.use(
  "/api",
  originGuard({ enabled: isProduction && allowedOrigins.length > 0, allowedOrigins }),
);
app.use("/api", apiNoStore());
app.use(
  "/api",
  createRateLimiter({
    windowMs: 60_000,
    max: 120,
    message: "Rate limit exceeded",
  }),
);

// Logging function
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  // Reduce exposure to slowloris-style attacks.
  httpServer.requestTimeout = 30_000;
  httpServer.headersTimeout = 35_000;
  httpServer.keepAliveTimeout = 15_000;

  const { storage, mode } = await createStorage();
  log(`storage mode: ${mode}`, "startup");
  const sessionMiddleware = createSessionMiddleware(storage, isProduction);

  // Register API routes
  await registerRoutes(httpServer, app, storage);
  setupStudyHub(httpServer, storage, sessionMiddleware);

  // Error handler
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // Serve static files in production
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    // Dev: setup Vite with middleware
    const { setupVite } = await import("./vite");
    await setupVite(app);
  }

  // Start server on localhost (Windows-safe)
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "127.0.0.1", () => {
    log(`serving on http://localhost:${port}`);
  });
})();
