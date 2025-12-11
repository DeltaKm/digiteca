import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
// import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { FtpStorageService } from "./ftpStorage";
import { iiifService } from "./iiifService";
import {
  insertCategorySchema,
  insertSubcategorySchema,
  insertDocumentSchema,
  updateDocumentSchema,
  searchDocumentsSchema,
  insertDocumentRelationSchema,
} from "@shared/schema";
import { z } from "zod";
import { randomUUID } from "crypto";
import csurf from "csurf";
import * as XLSX from "xlsx";
import multer from "multer";

// Mock user credentials for local development
const MOCK_USERS = {
  "admin@digiteca.local": {
    password: "pmHJeU%$WFuqV$5m",
    id: "admin-user-id",
    email: "admin@digiteca.local",
    firstName: "Admin",
    lastName: "User"
  }
};

// Mock authentication middleware for local development
const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.session && req.session.user) {
    req.user = {
      claims: req.session.user
    };
    next();
  } else {
    res.status(401).json({ message: "Non autenticato" });
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup session middleware for local development
  app.set("trust proxy", 1);
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true in production with HTTPS
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    },
  }));

  // Auth middleware - Disabled for local development
  // await setupAuth(app);

  // Auto-seed predefined categories on server startup
  try {
    await storage.seedPredefinedCategories();
  } catch (error) {
    console.error("Warning: Failed to auto-seed categories on startup:", error);
  }

  // CSRF protection for state-changing operations
  const csrfProtection = csurf({ cookie: false }); // Use session-based CSRF tokens

  // Auth routes
  app.get('/api/login', (req, res) => {
    // Redirect GET requests to /api/login to the frontend login page
    res.redirect('/login');
  });

  app.post('/api/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Check credentials
      const user = MOCK_USERS[email as keyof typeof MOCK_USERS];
      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Credenziali non valide" });
      }
      
      // Create or update user in database
      await storage.upsertUser({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: null,
      });
      
      // Set session
      req.session.user = {
        sub: user.id,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName
      };
      
      res.json({
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Errore durante il login" });
    }
  });

  app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Errore durante il logout" });
      }
      res.json({ message: "Logout effettuato con successo" });
    });
  });

  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // CSRF token endpoint for authenticated users
  app.get('/api/csrf-token', isAuthenticated, csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
  });

  // Public routes - no authentication required
  app.get("/api/documents", async (req, res) => {
    try {
      const params = searchDocumentsSchema.parse({
        ...req.query,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        isPublic: true, // Only public documents for public API
        status: "published", // Only published documents
      });

      const result = await storage.getDocuments(params);
      res.json(result);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get("/api/documents/:id", async (req, res) => {
    try {
      const document = await storage.getDocumentById(req.params.id);
      if (!document || !document.isPublic || document.status !== "published") {
        return res.status(404).json({ message: "Document not found" });
      }

      // Automatically generate IIIF URLs for images
      const enrichedDocument = { ...document };
      if (document.filePath && document.mimeType?.startsWith("image/")) {
        // Determine Base URL: use env var if set, otherwise derive from request
        // Force HTTPS for non-localhost environments to avoid Mixed Content errors
        let baseUrl: string;
        
        if (process.env.APP_BASE_URL && process.env.APP_BASE_URL.startsWith('http')) {
           baseUrl = process.env.APP_BASE_URL;
        } else {
           const host = req.get('host') || 'localhost:3000';
           const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
           const protocol = isLocal ? req.protocol : 'https';
           baseUrl = `${protocol}://${host}`;
        }

        enrichedDocument.iiifInfoUrl = `${baseUrl}/iiif/${document.id}/info.json`;
        enrichedDocument.iiifImageUrl = `${baseUrl}/iiif/${document.id}`;

        // Keep existing IIIF URLs if already set
        if (document.iiifInfoUrl) {
          enrichedDocument.iiifInfoUrl = document.iiifInfoUrl;
        }
        if (document.iiifImageUrl) {
          enrichedDocument.iiifImageUrl = document.iiifImageUrl;
        }
      }

      res.json(enrichedDocument);
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.get("/api/subcategories", async (req, res) => {
    try {
      const categoryId = req.query.categoryId as string;
      const subcategories = await storage.getSubcategories(categoryId);
      res.json(subcategories);
    } catch (error) {
      console.error("Error fetching subcategories:", error);
      res.status(500).json({ message: "Failed to fetch subcategories" });
    }
  });

  // Object storage routes for public file serving
  app.get("/public-objects/:filePath(*)", async (req, res) => {
    const filePath = req.params.filePath;
    const objectStorageService = new ObjectStorageService();
    try {
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error searching for public object:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Protected object routes
  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      console.log(`📥 Request for file: ${req.path}`);
      
      // Estrai il path del file dalla richiesta e decodifica URL encoding
      // req.path sarà tipo "/objects/assets/digiteka/kere/pratiche/2025/11/file.txt"
      const rawFilePath = req.path.replace(/^\/objects\//, '');
      const filePath = decodeURIComponent(rawFilePath);
      
      console.log(`📁 Raw path: ${rawFilePath}`);
      console.log(`📁 Decoded path: ${filePath}`);
      
      // Get user ID from authenticated request
      const userId = (req.user as any)?.claims?.sub;
      console.log(`👤 User ID: ${userId || 'unauthenticated'}`);
      
      // Cerca il documento nel database con tutte le possibili varianti del path
      let document = null;
      try {
        const allDocs = await storage.getDocuments({ 
          limit: 10000, // Aumentato per cercare in tutti i documenti
          page: 1,
          sortBy: "createdAt",
          sortOrder: "desc"
        });

        console.log(`🔍 Searching in ${allDocs.documents.length} documents...`);

        // Prova diverse varianti del path
        const pathVariants = [
          filePath,
          `/${filePath}`,
          req.path,
          decodeURIComponent(filePath),
          decodeURIComponent(`/${filePath}`),
          decodeURIComponent(req.path)
        ];

        console.log(`🔍 Path variants to search:`, pathVariants);

        document = allDocs.documents.find(doc => {
          if (!doc.filePath) return false;
          
          // Normalizza entrambi i path per il confronto
          const docPath = doc.filePath.replace(/^\//, '').replace(/\\/g, '/');
          
          const match = pathVariants.some(variant => {
            const normalizedVariant = variant.replace(/^\//, '').replace(/\\/g, '/');
            return docPath === normalizedVariant;
          });
          
          if (match) {
            console.log(`✅ MATCH FOUND! Document: "${doc.title}" (${doc.id})`);
            console.log(`   Doc path: ${doc.filePath}`);
            console.log(`   Matched with: ${filePath}`);
          }
          
          return match;
        });

        if (document) {
          console.log(`📄 Found document: ${document.title}`);
          console.log(`   - isPublic: ${document.isPublic}`);
          console.log(`   - status: ${document.status}`);
          console.log(`   - filePath: ${document.filePath}`);
        } else {
          console.log(`⚠️ Document not found in database for any path variant`);
          console.log(`   Searched ${allDocs.documents.length} documents`);
        }
      } catch (dbError) {
        console.error(`❌ Error querying database:`, dbError);
      }
      
      // Verifica permessi:
      // 1. Se l'utente è autenticato → accesso consentito
      // 2. Se il documento è pubblico E pubblicato → accesso consentito
      // 3. Altrimenti → accesso negato
      const isAuthenticated = !!userId;
      const isPublicDocument = document && document.isPublic && document.status === "published";
      
      if (!isAuthenticated && !isPublicDocument) {
        console.warn(`⛔ Access denied for file ${filePath}`);
        console.warn(`   - User authenticated: ${isAuthenticated}`);
        console.warn(`   - Document public: ${isPublicDocument}`);
        return res.status(403).json({ error: "Access denied" });
      }

      console.log(`✅ Access granted for file ${filePath}`);
      
      try {
        const ftpService = new FtpStorageService();
        
        // Determina il content type dal nome del file o dal documento
        let contentType = 'application/octet-stream';
        if (document?.mimeType) {
          contentType = document.mimeType;
        } else {
          const ext = filePath.split('.').pop()?.toLowerCase();
          const mimeTypes: Record<string, string> = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'pdf': 'application/pdf',
            'txt': 'text/plain',
            'webp': 'image/webp',
            'tiff': 'image/tiff',
            'tif': 'image/tiff',
          };
          if (ext && mimeTypes[ext]) {
            contentType = mimeTypes[ext];
          }
        }
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache per 1 anno
        
        // Scarica il file dall'FTP direttamente nella response
        // Se il file non esiste, questo fallirà e andremo nel catch
        await ftpService.downloadFileToResponse(filePath, res);
        
        console.log(`✅ File served successfully: ${filePath}`);
      } catch (ftpError) {
        console.error(`❌ Error downloading from FTP:`, ftpError);
        if (!res.headersSent) {
          return res.status(404).json({ error: "File not found on FTP server" });
        }
      }
    } catch (error) {
      console.error("Error serving file:", error instanceof Error ? error.message : String(error));
      if (!res.headersSent) {
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // IIIF Image API routes
  app.get("/iiif/:documentId/info.json", async (req, res) => {
    try {
      const document = await storage.getDocumentById(req.params.documentId);
      if (!document || !document.isPublic || document.status !== "published") {
        return res.status(404).json({ error: "Document not found" });
      }

      // Check if it's an image by MIME type or file extension
      const isImageByMime = document.mimeType?.startsWith("image/");
      const isImageByExtension = document.fileName && /\.(jpg|jpeg|png|gif|tiff|webp)$/i.test(document.fileName);
      const isImageByGenericMime = document.mimeType === "application/octet-stream" && isImageByExtension;

      if (!document.filePath || (!isImageByMime && !isImageByGenericMime)) {
        console.log(`Document ${document.id} rejected for IIIF:`, {
          filePath: document.filePath,
          mimeType: document.mimeType,
          fileName: document.fileName,
          isImageByMime,
          isImageByExtension,
          isImageByGenericMime
        });
        return res.status(400).json({ error: "Document is not an image" });
      }

      // Generate IIIF Image API info.json response using actual image dimensions
      let baseUrl: string;
      if (process.env.APP_BASE_URL && process.env.APP_BASE_URL.startsWith('http')) {
         baseUrl = `${process.env.APP_BASE_URL}/iiif/${document.id}`;
      } else {
         const host = req.get('host') || 'localhost:3000';
         const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
         const protocol = isLocal ? req.protocol : 'https';
         baseUrl = `${protocol}://${host}/iiif/${document.id}`;
      }
      
      const imageInfo = await iiifService.generateImageInfo(document.id, baseUrl);

      // Set proper headers for IIIF
      res.set({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      });

      res.json(imageInfo);
    } catch (error) {
      console.error("Error generating IIIF info.json:", error);
      res.status(500).json({ error: "Failed to generate IIIF info" });
    }
  });

  // IIIF Image API tile requests - full implementation with real image processing
  app.get("/iiif/:documentId/:region/:size/:rotation/:quality.:format", async (req, res) => {
    try {
      const document = await storage.getDocumentById(req.params.documentId);
      if (!document || !document.isPublic || document.status !== "published") {
        return res.status(404).json({ error: "Document not found" });
      }

      // Check if it's an image by MIME type or file extension
      const isImageByMime = document.mimeType?.startsWith("image/");
      const isImageByExtension = document.fileName && /\.(jpg|jpeg|png|gif|tiff|webp)$/i.test(document.fileName);
      const isImageByGenericMime = document.mimeType === "application/octet-stream" && isImageByExtension;

      if (!document.filePath || (!isImageByMime && !isImageByGenericMime)) {
        console.log(`Document ${document.id} rejected for IIIF:`, {
          filePath: document.filePath,
          mimeType: document.mimeType,
          fileName: document.fileName,
          isImageByMime,
          isImageByExtension,
          isImageByGenericMime
        });
        return res.status(400).json({ error: "Document is not an image" });
      }

      // Process the IIIF image request with real cropping, resizing, and format conversion
      await iiifService.processImageRequest(
        req.params.documentId,
        req.params.region,
        req.params.size,
        req.params.rotation,
        req.params.quality,
        req.params.format,
        res
      );
    } catch (error) {
      console.error("Error handling IIIF image request:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to process IIIF image request" });
      }
    }
  });

  // Protected admin routes
  app.get("/api/admin/documents", isAuthenticated, async (req, res) => {
    try {
      const params = searchDocumentsSchema.parse({
        ...req.query,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        // Admin can see all documents
      });

      const result = await storage.getDocuments(params);
      res.json(result);
    } catch (error) {
      console.error("Error fetching admin documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get("/api/admin/documents/:id", isAuthenticated, async (req, res) => {
    try {
      const document = await storage.getDocumentById(req.params.id);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      res.json(document);
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

  app.post("/api/admin/documents", isAuthenticated, csrfProtection, async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const documentData = insertDocumentSchema.parse({
        ...req.body,
        uploadedBy: userId,
        archiveCode: req.body.archiveCode || `DGT-${randomUUID().slice(0, 8).toUpperCase()}`,
      });

      const document = await storage.createDocument(documentData);
      res.status(201).json(document);
    } catch (error) {
      console.error("Error creating document:", error instanceof Error ? error.message : String(error));
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create document" });
    }
  });

  app.put("/api/admin/documents/:id", isAuthenticated, csrfProtection, async (req, res) => {
    try {
      const documentData = updateDocumentSchema.parse(req.body);
      const document = await storage.updateDocument(req.params.id, documentData);
      res.json(document);
    } catch (error) {
      console.error("Error updating document:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update document" });
    }
  });

  app.delete("/api/admin/documents/:id", isAuthenticated, csrfProtection, async (req, res) => {
    try {
      await storage.deleteDocument(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Document relations endpoints
  app.get("/api/admin/documents/:id/relations", isAuthenticated, async (req, res) => {
    try {
      const relations = await storage.getDocumentRelations(req.params.id);
      res.json(relations);
    } catch (error) {
      console.error("Error fetching document relations:", error);
      res.status(500).json({ message: "Failed to fetch document relations" });
    }
  });

  app.post("/api/admin/documents/:id/relations", isAuthenticated, csrfProtection, async (req, res) => {
    try {
      const relationData = insertDocumentRelationSchema.parse({
        ...req.body,
        fromDocumentId: req.params.id,
      });
      const relation = await storage.createDocumentRelation(relationData);
      res.status(201).json(relation);
    } catch (error) {
      console.error("Error creating document relation:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create document relation" });
    }
  });

  app.delete("/api/admin/documents/relations/:relationId", isAuthenticated, csrfProtection, async (req, res) => {
    try {
      await storage.deleteDocumentRelation(req.params.relationId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting document relation:", error);
      res.status(500).json({ message: "Failed to delete document relation" });
    }
  });

  // Category management routes
  app.post("/api/admin/categories", isAuthenticated, csrfProtection, async (req, res) => {
    try {
      const categoryData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(categoryData);
      res.status(201).json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.put("/api/admin/categories/:id", isAuthenticated, csrfProtection, async (req, res) => {
    try {
      const categoryData = insertCategorySchema.partial().parse(req.body);
      const category = await storage.updateCategory(req.params.id, categoryData);
      res.json(category);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete("/api/admin/categories/:id", isAuthenticated, csrfProtection, async (req, res) => {
    try {
      const { cascade, dryRun } = req.query;

      if (cascade === "true") {
        // Use cascade delete with transaction
        const result = await storage.deleteCategoryCascade(req.params.id, {
          dryRun: dryRun === "true"
        });

        if (dryRun === "true") {
          // Return impact preview for dry run
          res.json({
            message: "Dry run completed",
            impact: {
              subcategoriesAffected: result.subcategoriesAffected,
              documentsUpdated: result.documentsUpdated,
            }
          });
        } else {
          // Return success with impact details
          res.json({
            message: "Category deleted successfully",
            impact: {
              subcategoriesAffected: result.subcategoriesAffected,
              documentsUpdated: result.documentsUpdated,
            }
          });
        }
      } else {
        // Use simple delete (existing behavior)
        try {
          await storage.deleteCategory(req.params.id);
          res.status(204).send();
        } catch (error: any) {
          // Check if error is due to foreign key constraint
          if (error?.message?.includes("foreign key") || error?.code === "23503") {
            return res.status(409).json({
              message: "Cannot delete category: it contains documents or subcategories",
              suggestion: "Use cascade=true with dryRun=true to preview what will be affected, then cascade=true to delete everything"
            });
          }
          throw error; // Re-throw other errors
        }
      }
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Seed predefined categories endpoint
  app.post("/api/admin/seed-categories", isAuthenticated, csrfProtection, async (req, res) => {
    try {
      await storage.seedPredefinedCategories();
      res.json({ message: "Predefined categories seeded successfully" });
    } catch (error) {
      console.error("Error seeding categories:", error);
      res.status(500).json({ message: "Failed to seed categories" });
    }
  });

  // Maintenance endpoints
  app.post("/api/admin/maintenance/fix-manoscritti", isAuthenticated, csrfProtection, async (req, res) => {
    try {
      const { dryRun } = req.body;

      const result = await storage.fixManoscrittiInconsistency({
        dryRun: dryRun === true
      });

      if (dryRun === true) {
        // Return impact preview for dry run
        res.json({
          message: "Dry run completed - showing what would be changed",
          impact: {
            documentsReassigned: result.documentsReassigned,
            subcategoriesDeleted: result.subcategoriesDeleted,
            categoryDeleted: result.categoryDeleted,
          }
        });
      } else {
        // Return success with impact details
        res.json({
          message: "Data inconsistency fixed successfully",
          impact: {
            documentsReassigned: result.documentsReassigned,
            subcategoriesDeleted: result.subcategoriesDeleted,
            categoryDeleted: result.categoryDeleted,
          }
        });
      }
    } catch (error) {
      console.error("Error fixing manoscritti inconsistency:", error);
      res.status(500).json({ message: "Failed to fix data inconsistency" });
    }
  });

  // Subcategory management routes  
  app.post("/api/admin/subcategories", isAuthenticated, csrfProtection, async (req, res) => {
    try {
      const subcategoryData = insertSubcategorySchema.parse(req.body);
      const subcategory = await storage.createSubcategory(subcategoryData);
      res.status(201).json(subcategory);
    } catch (error) {
      console.error("Error creating subcategory:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create subcategory" });
    }
  });

  app.put("/api/admin/subcategories/:id", isAuthenticated, csrfProtection, async (req, res) => {
    try {
      const subcategoryData = insertSubcategorySchema.partial().parse(req.body);
      const subcategory = await storage.updateSubcategory(req.params.id, subcategoryData);
      res.json(subcategory);
    } catch (error) {
      console.error("Error updating subcategory:", error);
      res.status(500).json({ message: "Failed to update subcategory" });
    }
  });

  app.delete("/api/admin/subcategories/:id", isAuthenticated, csrfProtection, async (req, res) => {
    try {
      await storage.deleteSubcategory(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting subcategory:", error);
      res.status(500).json({ message: "Failed to delete subcategory" });
    }
  });

  // Configure multer for Excel file upload
  const excelUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
      // Accept Excel files
      const allowedMimes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel.sheet.macroEnabled.12'
      ];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only Excel files are allowed'));
      }
    },
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    }
  });

  // Excel import route
  app.post("/api/admin/import-excel", isAuthenticated, csrfProtection, excelUpload.single('excel'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No Excel file provided" });
      }

      // Parse Excel file
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet);

      console.log("Excel data parsed:", data);

      const categories: { name: string; subcategories: string[] }[] = [];
      const categoryMap = new Map<string, Set<string>>();

      // Process each row to extract categories and subcategories
      for (const row of data as any[]) {
        // Try different possible column names for category and subcategory
        const possibleCategoryFields = ['categoria', 'category', 'Categoria', 'Category', 'CATEGORIA'];
        const possibleSubcategoryFields = ['sottocategoria', 'subcategory', 'Sottocategoria', 'Subcategory', 'SOTTOCATEGORIA'];

        let categoryName = '';
        let subcategoryName = '';

        // Find category field
        for (const field of possibleCategoryFields) {
          if (row[field] && typeof row[field] === 'string') {
            categoryName = row[field].trim();
            break;
          }
        }

        // Find subcategory field
        for (const field of possibleSubcategoryFields) {
          if (row[field] && typeof row[field] === 'string') {
            subcategoryName = row[field].trim();
            break;
          }
        }

        if (categoryName) {
          if (!categoryMap.has(categoryName)) {
            categoryMap.set(categoryName, new Set());
          }
          if (subcategoryName) {
            categoryMap.get(categoryName)!.add(subcategoryName);
          }
        }
      }

      // Convert map to array format
      categoryMap.forEach((subcategoriesSet, categoryName) => {
        categories.push({
          name: categoryName,
          subcategories: Array.from(subcategoriesSet)
        });
      });

      console.log("Extracted categories:", categories);

      // Store categories and subcategories in database with idempotency
      const insertedCategories = [];
      const insertedSubcategories = [];
      const skippedCategories = [];
      const skippedSubcategories = [];

      for (const categoryData of categories) {
        try {
          // Check if category already exists by slug
          const existingCategories = await storage.getCategories();
          const slug = categoryData.name.toLowerCase().replace(/\s+/g, '-');
          const existingCategory = existingCategories.find(cat => cat.slug === slug);

          let category;
          if (existingCategory) {
            category = existingCategory;
            skippedCategories.push(existingCategory);
            console.log(`Category "${categoryData.name}" already exists, skipping`);
          } else {
            // Create new category
            category = await storage.createCategory({
              name: categoryData.name,
              slug: slug,
              description: `Categoria importata da Excel: ${categoryData.name}`,
              color: '#3B82F6'
            });
            insertedCategories.push(category);
            console.log(`Created new category: ${categoryData.name}`);
          }

          // Create subcategories for this category
          for (const subcategoryName of categoryData.subcategories) {
            try {
              // Check if subcategory already exists by name in this category
              const existingSubcategories = await storage.getSubcategories();
              const subcategorySlug = subcategoryName.toLowerCase().replace(/\s+/g, '-');
              const existingSubcategory = existingSubcategories.find(sub => 
                sub.categoryId === category.id && sub.slug === subcategorySlug
              );

              if (existingSubcategory) {
                skippedSubcategories.push(existingSubcategory);
                console.log(`Subcategory "${subcategoryName}" already exists in category "${categoryData.name}", skipping`);
              } else {
                const subcategory = await storage.createSubcategory({
                  name: subcategoryName,
                  slug: subcategorySlug,
                  description: `Sottocategoria importata da Excel: ${subcategoryName}`,
                  categoryId: category.id
                });
                insertedSubcategories.push(subcategory);
                console.log(`Created new subcategory: ${subcategoryName} in ${categoryData.name}`);
              }
            } catch (error) {
              console.error(`Error processing subcategory ${subcategoryName}:`, error);
              // Continue with other subcategories
            }
          }
        } catch (error) {
          console.error(`Error processing category ${categoryData.name}:`, error);
          // Continue with other categories
        }
      }

      res.json({
        message: "Excel file processed successfully",
        categoriesFound: categories.length,
        categoriesInserted: insertedCategories.length,
        subcategoriesInserted: insertedSubcategories.length,
        categoriesSkipped: skippedCategories.length,
        subcategoriesSkipped: skippedSubcategories.length,
        categories: insertedCategories,
        subcategories: insertedSubcategories
      });

    } catch (error) {
      console.error("Error processing Excel file:", error);
      res.status(500).json({ 
        message: "Failed to process Excel file",
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // Statistics route
  app.get("/api/admin/stats", isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ message: "Failed to fetch statistics" });
    }
  });

  // IIIF Manifest routes
  app.post("/api/admin/manifests", isAuthenticated, csrfProtection, async (req, res) => {
    try {
      const { manifestService } = await import("./manifestService");
      const userId = (req.user as any)?.claims?.sub;
      
      const { 
        manifest, 
        title, 
        description, 
        imageUrls,
        categoryId,
        subcategoryId,
        status,
        isPublic,
        tags,
        keywords
      } = req.body;
      
      console.log('📝 Saving manifest with document data:', {
        title,
        categoryId,
        subcategoryId,
        status,
        isPublic,
        tags,
        keywords,
        imageCount: imageUrls?.length || 0
      });
      
      if (!manifest || !manifest['@context'] || !manifest.sequences) {
        return res.status(400).json({ message: "Invalid IIIF manifest format" });
      }

      // Ensure the manifest has required fields
      if (!manifest.label) {
        manifest.label = title || "Untitled Manifest";
      }
      
      if (!manifest.description && description) {
        manifest.description = description;
      }

      // Prepare document data
      const documentData = {
        title,
        description,
        categoryId,
        subcategoryId,
        status,
        isPublic,
        tags,
        keywords,
      };

      const result = await manifestService.saveManifest(manifest, userId, imageUrls, documentData);
      
      console.log('✅ Manifest saved successfully:', result.manifestId);
      
      res.status(201).json({
        message: "Manifest saved successfully",
        manifestId: result.manifestId,
        manifestUrl: result.manifestUrl,
      });
    } catch (error) {
      console.error("❌ Error saving manifest:", error);
      res.status(500).json({ message: "Failed to save manifest" });
    }
  });

  app.get("/api/admin/manifests", isAuthenticated, async (req, res) => {
    try {
      const { manifestService } = await import("./manifestService");
      const manifests = await manifestService.listManifests();
      res.json(manifests);
    } catch (error) {
      console.error("Error listing manifests:", error);
      res.status(500).json({ message: "Failed to list manifests" });
    }
  });

  app.get("/api/manifests/:manifestId", async (req, res) => {
    try {
      const { manifestService } = await import("./manifestService");
      const manifest = await manifestService.getManifest(req.params.manifestId);
      
      if (!manifest) {
        return res.status(404).json({ error: "Manifest not found" });
      }

      res.set({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=3600',
      });

      res.json(manifest);
    } catch (error) {
      console.error("Error getting manifest:", error);
      res.status(500).json({ error: "Failed to get manifest" });
    }
  });

  app.get("/manifests/:manifestId", async (req, res) => {
    // Alias for public manifest access
    try {
      const manifestId = req.params.manifestId;
      console.log(`📖 Fetching manifest with ID: ${manifestId}`);
      
      const { manifestService } = await import("./manifestService");
      const manifest = await manifestService.getManifest(manifestId);
      
      if (!manifest) {
        console.log(`❌ Manifest not found for ID: ${manifestId}`);
        return res.status(404).json({ error: "Manifest not found" });
      }

      console.log(`✅ Manifest found: ${manifest.label || 'Untitled'}`);
      res.set({
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=3600',
      });

      res.json(manifest);
    } catch (error) {
      console.error("❌ Error getting manifest:", error);
      res.status(500).json({ error: "Failed to get manifest" });
    }
  });

  app.delete("/api/admin/manifests/:manifestId", isAuthenticated, csrfProtection, async (req, res) => {
    try {
      const { manifestService } = await import("./manifestService");
      const userId = (req.user as any)?.claims?.sub;
      
      const success = await manifestService.deleteManifest(req.params.manifestId, userId);
      
      if (!success) {
        return res.status(404).json({ message: "Manifest not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Error deleting manifest:", error);
      res.status(500).json({ message: "Failed to delete manifest" });
    }
  });

  // File upload routes
  // FTP Upload - accetta il file direttamente nel body
  app.post("/api/ftp/upload", isAuthenticated, csrfProtection, async (req, res) => {
    console.log("\n========================================");
    console.log("📤 FTP UPLOAD REQUEST RECEIVED");
    console.log("========================================");
    const ftpService = new FtpStorageService();
    
    try {
      // Ottieni informazioni dal query parameters o headers
      const categoryName = req.query.category as string | undefined;
      const subcategoryName = req.query.subcategory as string | undefined;
      const filename = req.query.filename as string | undefined;
      
      console.log(`📁 Category: ${categoryName}`);
      console.log(`📂 Subcategory: ${subcategoryName}`);
      console.log(`📄 Filename: ${filename}`);
      
      // Leggi il body come buffer
      const chunks: Buffer[] = [];
      
      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      req.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          
          console.log(`📦 Buffer size: ${buffer.length} bytes`);
          
          if (buffer.length === 0) {
            console.log("❌ ERROR: Empty file buffer!");
            return res.status(400).json({ error: "Empty file" });
          }
          
          // Upload su FTP
          console.log("🚀 Starting FTP upload...");
          console.log(`📍 Destination: assets/digiteka/${categoryName}/${subcategoryName}/YYYY/MM/${filename}`);
          
          const result = await ftpService.uploadFromBuffer(buffer, {
            categoryName,
            subcategoryName,
            filename,
          });
          
          console.log(`✅ FTP UPLOAD SUCCESS!`);
          console.log(`📍 Full path: ${result.path}`);
          console.log("========================================\n");
          
          res.json({
            success: true,
            path: result.path,
            url: result.url,
            objectPath: result.path, // Per compatibilità con il client esistente
          });
        } catch (uploadError) {
          console.error("❌ FTP upload error:", uploadError);
          res.status(500).json({ error: "Failed to upload to FTP" });
        }
      });
      
      req.on('error', (error) => {
        console.error("❌ Request error:", error);
        res.status(500).json({ error: "Request error" });
      });
      
    } catch (error) {
      console.error("❌ Error in FTP upload route:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Original upload route (mantiene compatibilità con Google Cloud Storage)
  app.post("/api/objects/upload", isAuthenticated, csrfProtection, async (req, res) => {
    console.log("\n========================================");
    console.log("📤 /api/objects/upload CALLED (OLD ENDPOINT)");
    console.log("========================================");
    
    // Usa FTP per upload diretto
    const ftpService = new FtpStorageService();
    
    try {
      // Ottieni informazioni dal query parameters o body
      const categoryName = req.query.category as string | undefined || req.body.categoryName as string | undefined;
      const subcategoryName = req.query.subcategory as string | undefined || req.body.subcategoryName as string | undefined;
      const filename = req.query.filename as string | undefined || req.body.filename as string | undefined;
      
      console.log(`📁 Category: ${categoryName}`);
      console.log(`📂 Subcategory: ${subcategoryName}`);
      console.log(`📄 Filename: ${filename}`);
      
      // Leggi il body come buffer
      const chunks: Buffer[] = [];
      
      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      req.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);
          
          console.log(`📦 Buffer size: ${buffer.length} bytes`);
          
          if (buffer.length === 0) {
            console.log("❌ ERROR: Empty file buffer!");
            return res.status(400).json({ error: "Empty file" });
          }
          
          // Upload su FTP
          console.log("🚀 Starting FTP upload...");
          const result = await ftpService.uploadFromBuffer(buffer, {
            categoryName,
            subcategoryName,
            filename,
          });
          
          console.log(`✅ FTP UPLOAD SUCCESS!`);
          console.log(`📍 Full path: ${result.path}`);
          console.log("========================================\n");
          
          res.json({
            success: true,
            uploadURL: result.url,
            objectPath: result.path,
          });
        } catch (uploadError) {
          console.error("❌ FTP upload error:", uploadError);
          res.status(500).json({ error: "Failed to upload to FTP" });
        }
      });
      
      req.on('error', (error) => {
        console.error("❌ Request error:", error);
        res.status(500).json({ error: "Request error" });
      });
      
    } catch (error) {
      console.error("❌ Error in /api/objects/upload:", error);
      res.status(500).json({ error: "Failed to process upload" });
    }
  });

  app.post("/api/objects/set-acl", isAuthenticated, csrfProtection, async (req, res) => {
    // Con FTP non abbiamo bisogno di ACL, i file sono già accessibili
    // Restituiamo semplicemente il path del file
    const userId = (req.user as any)?.claims?.sub;
    try {
      if (!req.body.uploadURL) {
        return res.status(400).json({ error: "uploadURL is required" });
      }
      
      // Per FTP, il path è già nel formato corretto
      const objectPath = req.body.uploadURL;
      
      console.log(`FTP file uploaded: ${objectPath}, userId: ${userId}`);
      res.json({ objectPath });
    } catch (error) {
      console.error("Error setting ACL:", error);
      res.status(500).json({ error: "Failed to set ACL" });
    }
  });

  app.put("/api/admin/documents/:id/file", isAuthenticated, csrfProtection, async (req, res) => {
    if (!req.body.fileURL) {
      return res.status(400).json({ error: "fileURL is required" });
    }

    const userId = (req.user as any)?.claims?.sub;
    try {
      // Con FTP, il file è già stato caricato, salviamo solo il path
      const objectPath = req.body.fileURL;

      // Update document with file information
      await storage.updateDocument(req.params.id, {
        filePath: objectPath,
        fileName: req.body.fileName || "document",
        originalFileName: req.body.originalFileName || req.body.fileName || "document",
        fileSize: req.body.fileSize || 0,
        mimeType: req.body.mimeType || "application/octet-stream",
      });

      console.log(`File associated with document ${req.params.id}: ${objectPath}, userId: ${userId}`);
      res.json({ objectPath });
    } catch (error) {
      console.error("Error updating document file:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}