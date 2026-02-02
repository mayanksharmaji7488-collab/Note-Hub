
import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { seed } from "./seed";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure multer for file storage
const storageConfig = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storageConfig,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Set up auth routes and middleware
  setupAuth(app);

  // Serve uploaded files statically
  app.use("/uploads", express.static(uploadDir));

  // Seed database
  await seed();

  // --- API Routes ---

  app.get(api.notes.list.path, async (req, res) => {
    // Only logged in users can view notes
    if (!req.isAuthenticated()) return res.status(401).send();

    const search = req.query.search as string | undefined;
    const notes = await storage.getNotes(search);
    res.json(notes);
  });

  app.get(api.notes.get.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send();
    
    const note = await storage.getNote(Number(req.params.id));
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

    try {
      // Validate other fields
      const input = {
        title: req.body.title,
        subject: req.body.subject,
        semester: req.body.semester,
        description: req.body.description,
        fileName: req.file.originalname,
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

  return httpServer;
}
