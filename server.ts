import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import { PDFDocument } from "pdf-lib";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  const storage = multer.memoryStorage();
  const upload = multer({ storage });

  // PDF Trimming Endpoint
  app.post("/api/trim-pdf", upload.single("file"), async (req, res) => {
    try {
      const { startPage, endPage } = req.body;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const pdfDoc = await PDFDocument.load(file.buffer);
      const totalPages = pdfDoc.getPageCount();

      const start = Math.max(1, parseInt(startPage)) - 1;
      const end = Math.min(totalPages, parseInt(endPage)) - 1;

      if (start > end) {
        return res.status(400).json({ error: "Invalid page range" });
      }

      const newPdfDoc = await PDFDocument.create();
      const copiedPages = await newPdfDoc.copyPages(pdfDoc, 
        Array.from({ length: end - start + 1 }, (_, i) => start + i)
      );
      
      copiedPages.forEach((page) => newPdfDoc.addPage(page));

      const pdfBytes = await newPdfDoc.save();
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="trimmed_${file.originalname}"`);
      res.send(Buffer.from(pdfBytes));
    } catch (error: any) {
      console.error("PDF Trim Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
