import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import path from "path";
import fs from "fs/promises";
import { nanoid } from "nanoid";
import { fileURLToPath } from "url";

const viteLogger = createLogger();

export async function setupVite(app: Express) {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: true, // Windows-safe
      allowedHosts: true as const,
    },
    appType: "custom",
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
  });

  // Add Vite's middleware
  app.use(vite.middlewares);

  // ESM-safe __dirname for Windows
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientIndex = path.resolve(__dirname, "..", "client", "index.html");

  // Catch-all route for client-side routing
  app.use(async (req, res, next) => {
  try {
    const url = req.originalUrl;

    let template = await fs.readFile(clientIndex, "utf-8");

    // Cache-busting main.tsx
    template = template.replace(
      `src="/src/main.tsx"`,
      `src="/src/main.tsx?v=${nanoid()}"`
    );

    const html = await vite.transformIndexHtml(url, template);
    res.status(200).set({ "Content-Type": "text/html" }).send(html);
  } catch (err) {
    vite.ssrFixStacktrace(err as Error);
    next(err);
  }
});
}
