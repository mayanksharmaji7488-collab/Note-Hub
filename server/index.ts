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

function getStartupHints(error: unknown): string[] {
  const message = error instanceof Error ? error.message : String(error);
  const hints: string[] = [];

  if (message.includes("SESSION_SECRET")) {
    hints.push("Set SESSION_SECRET in your production environment variables.");
  }

  if (message.includes("DATABASE_URL")) {
    hints.push("Set DATABASE_URL to your production Postgres connection string.");
  }

  if (message.includes("Could not find the build directory")) {
    hints.push("Run the production build before starting the server, or deploy the built client with the server.");
  }

  return hints;
}

function getListenConfig() {
  const port = Number.parseInt(process.env.PORT || "5000", 10);

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid PORT value: ${process.env.PORT ?? "(empty)"}`);
  }

  return {
    port,
    host: process.env.HOST?.trim() || (isProduction ? "0.0.0.0" : "127.0.0.1"),
  };
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

async function startServer() {
  // Reduce exposure to slowloris-style attacks.
  httpServer.requestTimeout = 30_000;
  httpServer.headersTimeout = 35_000;
  httpServer.keepAliveTimeout = 15_000;
  httpServer.on("error", (error) => {
    console.error("[startup] HTTP server error");
    console.error(error);
    process.exit(1);
  });

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
  const { port, host } = getListenConfig();
  httpServer.listen(port, host, () => {
    const visibleHost = host === "0.0.0.0" ? "localhost" : host;
    log(`serving on http://${visibleHost}:${port}`);
  });
}

startServer().catch((error) => {
  console.error("[startup] Failed to start server");
  console.error(error);

  for (const hint of getStartupHints(error)) {
    console.error(`[startup] Hint: ${hint}`);
  }

  process.exit(1);
});
