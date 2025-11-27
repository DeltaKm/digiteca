import { sql, relations } from "drizzle-orm";
import {
  index,
  json,
  mysqlTable,
  timestamp,
  varchar,
  text,
  int,
  boolean,
} from "drizzle-orm/mysql-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = mysqlTable(
  "sessions",
  {
    sid: varchar("sid", { length: 255 }).primaryKey(),
    sess: json("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => ({
    expireIdx: index("IDX_session_expire").on(table.expire),
  }),
);

// User storage table (required for Replit Auth)
export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: varchar("email", { length: 255 }).unique(),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  profileImageUrl: varchar("profile_image_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Categories table
export const categories = mysqlTable("categories", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#3B82F6"), // hex color
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subcategories table
export const subcategories = mysqlTable("subcategories", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  description: text("description"),
  categoryId: varchar("category_id", { length: 36 }).references(() => categories.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Documents table
export const documents = mysqlTable("documents", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  categoryId: varchar("category_id", { length: 36 }).references(() => categories.id),
  subcategoryId: varchar("subcategory_id", { length: 36 }).references(() => subcategories.id),

  // File information
  fileName: varchar("file_name", { length: 255 }).notNull(),
  originalFileName: varchar("original_file_name", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileSize: int("file_size").notNull(), // in bytes
  mimeType: varchar("mime_type", { length: 100 }).notNull(),

  // IIIF information
  iiifManifestId: varchar("iiif_manifest_id", { length: 100 }), // Full manifestId for precise lookup
  iiifManifestUrl: varchar("iiif_manifest_url", { length: 500 }),
  iiifImageUrl: varchar("iiif_image_url", { length: 500 }),
  iiifInfoUrl: varchar("iiif_info_url", { length: 500 }), // IIIF Image API info.json endpoint

  // Metadata
  author: varchar("author", { length: 255 }),
  dateCreated: timestamp("date_created"),
  century: varchar("century", { length: 50 }),
  period: varchar("period", { length: 100 }),
  location: varchar("location", { length: 255 }),
  provenance: text("provenance"),
  materials: varchar("materials", { length: 255 }),
  dimensions: varchar("dimensions", { length: 100 }),
  condition: varchar("condition", { length: 100 }),

  // Archive metadata
  archiveCode: varchar("archive_code", { length: 100 }).unique(),
  collectionName: varchar("collection_name", { length: 255 }),
  tags: json("tags").$type<string[]>(), // JSON array of tags
  keywords: json("keywords").$type<string[]>(), // JSON array of keywords

  // Extended Regesti metadata (all optional for backward compatibility)
  documentType: varchar("document_type", { length: 100 }), // atto notarile, lettera, pergamena, registro...
  transcriptionEditor: varchar("transcription_editor", { length: 255 }), // Redattore della trascrizione/edizione
  languageOriginal: varchar("language_original", { length: 50 }), // latino, volgare, italiano
  languageTranscription: varchar("language_transcription", { length: 50 }), // lingua della trascrizione
  languageTranslation: varchar("language_translation", { length: 50 }), // lingua della traduzione

  // Text content fields for Regesti
  textRegesto: text("text_regesto"), // sintesi strutturata
  textTranscription: text("text_transcription"), // trascrizione integrale
  textTranslation: text("text_translation"), // traduzione
  textAbstract: text("text_abstract"), // riassunto moderno
  textEdition: text("text_edition"), // edizione critica
  transcriptionNotes: text("transcription_notes"), // note paleografiche o critiche
  corredi: text("corredi"), // glossari, indici, commenti, cronologie
  corrediLinks: json("corredi_links").$type<string[]>(), // collegamenti ai corredi

  // Rights and quality control
  rightsLicense: varchar("rights_license", { length: 100 }), // CC-BY, pubblico dominio, ecc.
  qcStatus: varchar("qc_status", { length: 20 }).default("bozza"), // bozza, verificato, pubblicato

  // Master file information
  masterFormat: varchar("master_format", { length: 50 }), // docx, pdf, txt
  masterUri: varchar("master_uri", { length: 500 }), // collegamento a file master
  derivativeUris: json("derivative_uris").$type<string[]>(), // collegamenti a file derivati

  // Structured source reference (for Regesti)
  sourceReference: text("source_reference"), // archivio, fondo, segnatura
  subjects: json("subjects").$type<string[]>(), // nomi di persone, famiglie, enti citati

  // Status and visibility
  status: varchar("status", { length: 50 }).default("draft"), // draft, published, archived
  isPublic: boolean("is_public").default(true),

  // System fields
  uploadedBy: varchar("uploaded_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Document relations table for internal links
export const documentRelations = mysqlTable("document_relations", {
  id: varchar("id", { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
  fromDocumentId: varchar("from_document_id", { length: 36 }).references(() => documents.id, { onDelete: "cascade" }).notNull(),
  toDocumentId: varchar("to_document_id", { length: 36 }).references(() => documents.id, { onDelete: "cascade" }).notNull(),
  relationType: varchar("relation_type", { length: 50 }).notNull(), // "references", "related", "source", etc.
  description: text("description"), // optional description of the relation
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const categoriesRelations = relations(categories, ({ many }) => ({
  documents: many(documents),
  subcategories: many(subcategories),
}));

export const subcategoriesRelations = relations(subcategories, ({ one, many }) => ({
  category: one(categories, {
    fields: [subcategories.categoryId],
    references: [categories.id],
  }),
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  category: one(categories, {
    fields: [documents.categoryId],
    references: [categories.id],
  }),
  subcategory: one(subcategories, {
    fields: [documents.subcategoryId],
    references: [subcategories.id],
  }),
  uploadedByUser: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id],
  }),
  relationsFrom: many(documentRelations, {
    relationName: "fromDocument",
  }),
  relationsTo: many(documentRelations, {
    relationName: "toDocument",
  }),
}));

export const documentRelationsRelations = relations(documentRelations, ({ one }) => ({
  fromDocument: one(documents, {
    fields: [documentRelations.fromDocumentId],
    references: [documents.id],
    relationName: "fromDocument",
  }),
  toDocument: one(documents, {
    fields: [documentRelations.toDocumentId],
    references: [documents.id],
    relationName: "toDocument",
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  uploadedDocuments: many(documents),
}));

// Insert schemas
export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSubcategorySchema = createInsertSchema(subcategories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  tags: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  corrediLinks: z.array(z.string()).optional(),
  derivativeUris: z.array(z.string()).optional(),
  subjects: z.array(z.string()).optional(),
});

export const insertDocumentRelationSchema = createInsertSchema(documentRelations).omit({
  id: true,
  createdAt: true,
});

export const updateDocumentSchema = insertDocumentSchema.partial();

// Search schema
export const searchDocumentsSchema = z.object({
  query: z.string().optional(),
  categoryId: z.string().optional(),
  subcategoryId: z.string().optional(),
  period: z.string().optional(),
  format: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional(),
  status: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "title", "dateCreated", "updatedAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// Type exports
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Subcategory = typeof subcategories.$inferSelect;
export type InsertSubcategory = z.infer<typeof insertSubcategorySchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type UpdateDocument = z.infer<typeof updateDocumentSchema>;
export type SearchDocuments = z.infer<typeof searchDocumentsSchema>;
export type DocumentRelation = typeof documentRelations.$inferSelect;
export type InsertDocumentRelation = z.infer<typeof insertDocumentRelationSchema>;

// Predefined categories and subcategories from PDF specification
export const PREDEFINED_CATEGORIES = [
  {
    name: "Biblioteca",
    slug: "biblioteca",
    description: "Collezione di materiali bibliografici",
    color: "#2563EB",
    subcategories: [
      { name: "libri", slug: "libri", description: "volumi a stampa rilegati, monografie" },
      { name: "periodici", slug: "periodici", description: "riviste, giornali, bollettini con periodicità" },
      { name: "manoscritti", slug: "manoscritti", description: "testi scritti a mano, non a stampa" },
      { name: "opuscoli", slug: "opuscoli", description: "pubblicazioni brevi e non periodiche" },
      { name: "cartografia", slug: "cartografia", description: "carte, mappe, atlanti" },
      { name: "cataloghi", slug: "cataloghi", description: "elenchi o repertori bibliografici" },
      { name: "ebook", slug: "ebook", description: "pubblicazioni nate in formato digitale" },
      { name: "multimediali", slug: "multimediali", description: "CD, DVD, risorse ibride legate a libri" },
    ],
  },
  {
    name: "Archivi",
    slug: "archivi",
    description: "Documenti archivistici e registri",
    color: "#7C3AED",
    subcategories: [
      { name: "notarili", slug: "notarili", description: "atti rogati da notai" },
      { name: "registri", slug: "registri", description: "libri ufficiali numerati" },
      { name: "carteggi", slug: "carteggi", description: "corrispondenza e lettere in serie" },
      { name: "amministrativi", slug: "amministrativi", description: "delibere, determine, atti di uffici" },
      { name: "mappe", slug: "mappe", description: "piante, catasti, mappe amministrative" },
      { name: "pergamene", slug: "pergamene", description: "documenti su supporto pergamenaceo" },
    ],
  },
  {
    name: "Immagini",
    slug: "immagini",
    description: "Fotografie e documenti iconografici",
    color: "#DC2626",
    subcategories: [
      { name: "storiche", slug: "storiche", description: "fotografie d'epoca, anteriori a 1970" },
      { name: "recenti", slug: "recenti", description: "fotografie contemporanee o attuali" },
      { name: "ritratti", slug: "ritratti", description: "immagini singole di persona" },
      { name: "gruppi", slug: "gruppi", description: "foto di più persone o collettività" },
      { name: "grafica", slug: "grafica", description: "incisioni, litografie, stampe d'arte" },
      { name: "illustrazioni", slug: "illustrazioni", description: "disegni, vignette, tavole illustrative" },
      { name: "cartoline", slug: "cartoline", description: "cartoline illustrate, storiche o moderne" },
      { name: "diapositive", slug: "diapositive", description: "diapositive e negativi fotografici" },
    ],
  },
  {
    name: "Video",
    slug: "video",
    description: "Materiali audiovisivi e registrazioni video",
    color: "#EA580C",
    subcategories: [
      { name: "eventi", slug: "eventi", description: "registrazioni di cerimonie, incontri pubblici" },
      { name: "spettacoli", slug: "spettacoli", description: "teatro, cinema, concerti ripresi dal vivo" },
      { name: "manifestazioni", slug: "manifestazioni", description: "feste, cortei, raduni" },
      { name: "documentari", slug: "documentari", description: "produzioni divulgative a tema locale o storico" },
      { name: "interviste", slug: "interviste", description: "testimonianze filmate" },
      { name: "reportage", slug: "reportage", description: "servizi giornalistici o cronache filmate" },
    ],
  },
  {
    name: "Audio",
    slug: "audio",
    description: "Registrazioni sonore e testimonianze orali",
    color: "#16A34A",
    subcategories: [
      { name: "storiche", slug: "storiche", description: "registrazioni d'epoca (dischi, nastri)" },
      { name: "interviste", slug: "interviste", description: "testimonianze orali registrate" },
      { name: "memorie", slug: "memorie", description: "racconti autobiografici o collettivi orali" },
      { name: "musiche", slug: "musiche", description: "canti, musica popolare, registrazioni musicali" },
      { name: "suoni", slug: "suoni", description: "registrazioni ambientali, rumori caratteristici" },
    ],
  },
  {
    name: "Kere",
    slug: "kere",
    description: "Oggetti materiali e tradizioni immateriali",
    color: "#CA8A04",
    subcategories: [
      { name: "utensili", slug: "utensili", description: "strumenti domestici o di uso quotidiano" },
      { name: "attrezzi", slug: "attrezzi", description: "strumenti da lavoro agricolo o artigianale" },
      { name: "arredi", slug: "arredi", description: "mobili e suppellettili d'uso comune" },
      { name: "religione", slug: "religione", description: "oggetti liturgici, devozioni, ex voto" },
      { name: "tradizioni", slug: "tradizioni", description: "costumi, abiti, maschere popolari" },
      { name: "pratiche", slug: "pratiche", description: "gesti, rituali, consuetudini immateriali" },
      { name: "multimediali", slug: "multimediali", description: "supporti audiovisivi di documentazione etnografica" },
    ],
  },
  {
    name: "Radici",
    slug: "radici",
    description: "Genealogie, biografie e memorie familiari",
    color: "#7C2D12",
    subcategories: [
      { name: "persone", slug: "persone", description: "schede anagrafiche di singoli individui" },
      { name: "famiglie", slug: "famiglie", description: "nuclei familiari e genealogie di casato" },
      { name: "genealogie", slug: "genealogie", description: "alberi genealogici e linee di discendenza" },
      { name: "biografie", slug: "biografie", description: "narrazioni sulla vita di persone locali" },
      { name: "fotografie", slug: "fotografie", description: "foto di individui e famiglie" },
      { name: "documenti", slug: "documenti", description: "atti e carte personali" },
      { name: "memorie", slug: "memorie", description: "testimonianze personali e familiari" },
      { name: "storie", slug: "storie", description: "racconti e tradizioni tramandate oralmente" },
    ],
  },
  {
    name: "Materiali",
    slug: "materiali",
    description: "Materiali didattici e divulgativi",
    color: "#BE185D",
    subcategories: [
      { name: "didattici", slug: "didattici", description: "sussidi per scuole, schede, manuali" },
      { name: "mostre", slug: "mostre", description: "pannelli, cataloghi, materiali espositivi" },
      { name: "animazioni", slug: "animazioni", description: "prodotti multimediali e grafici per divulgazione" },
      { name: "media", slug: "media", description: "video, audio, contenuti digitali prodotti ad hoc" },
      { name: "supporti", slug: "supporti", description: "materiali tecnici di comunicazione" },
      { name: "pannelli", slug: "pannelli", description: "allestimenti fisici e digitali per esposizioni" },
    ],
  },
  {
    name: "Regesti",
    slug: "regesti",
    description: "Trascrizioni, traduzioni e regesti documentari",
    color: "#374151",
    subcategories: [
      { name: "regesti", slug: "regesti", description: "sintesi strutturata di documenti" },
      { name: "trascrizioni", slug: "trascrizioni", description: "copie integrali e fedeli del testo originale" },
      { name: "traduzioni", slug: "traduzioni", description: "versioni del documento in altra lingua" },
      { name: "abstract", slug: "abstract", description: "riassunti moderni, non diplomatici" },
      { name: "edizioni", slug: "edizioni", description: "testi rivisti criticamente" },
      { name: "corredi", slug: "corredi", description: "strumenti di supporto: indici, glossari, commenti" },
    ],
  },
] as const;