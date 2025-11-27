import {
  users,
  categories,
  subcategories,
  documents,
  documentRelations,
  type User,
  type UpsertUser,
  type Category,
  type InsertCategory,
  type Subcategory,
  type InsertSubcategory,
  type Document,
  type InsertDocument,
  type UpdateDocument,
  type SearchDocuments,
  type DocumentRelation,
  type InsertDocumentRelation,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, like, desc, asc, count, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Category operations
  getCategories(): Promise<Category[]>;
  getCategoryById(id: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
  deleteCategoryCascade(id: string, options?: { dryRun?: boolean }): Promise<{
    subcategoriesAffected: number;
    documentsUpdated: number;
    success: boolean;
  }>;
  upsertCategory(category: InsertCategory): Promise<Category>;

  // Subcategory operations
  getSubcategories(categoryId?: string): Promise<Subcategory[]>;
  getSubcategoryById(id: string): Promise<Subcategory | undefined>;
  createSubcategory(subcategory: InsertSubcategory): Promise<Subcategory>;
  updateSubcategory(id: string, subcategory: Partial<InsertSubcategory>): Promise<Subcategory>;
  deleteSubcategory(id: string): Promise<void>;
  upsertSubcategory(subcategory: InsertSubcategory): Promise<Subcategory>;

  // Seeding operations
  seedPredefinedCategories(): Promise<void>;

  // Maintenance operations
  fixManoscrittiInconsistency(options?: { dryRun?: boolean }): Promise<{
    documentsReassigned: number;
    subcategoriesDeleted: number;
    categoryDeleted: boolean;
    success: boolean;
  }>;

  // Document operations
  getDocuments(params: SearchDocuments): Promise<{ documents: Document[]; total: number }>;
  getDocumentById(id: string): Promise<Document | undefined>;
  getDocumentByArchiveCode(code: string): Promise<Document | undefined>;
  getDocumentByManifestId(manifestId: string): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, document: UpdateDocument): Promise<Document>;
  deleteDocument(id: string): Promise<void>;

  // Document relations operations
  getDocumentRelations(documentId: string): Promise<DocumentRelation[]>;
  createDocumentRelation(relation: InsertDocumentRelation): Promise<DocumentRelation>;
  deleteDocumentRelation(relationId: string): Promise<void>;

  // Statistics
  getStats(): Promise<{
    totalDocuments: number;
    totalImages: number;
    totalCategories: number;
    todayUploads: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const userId = userData.id || crypto.randomUUID();
    await db
      .insert(users)
      .values({ ...userData, id: userId })
      .onDuplicateKeyUpdate({
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      });
    
    // Fetch the user after insert/update
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    return user;
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(asc(categories.name));
  }

  async getCategoryById(id: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const id = crypto.randomUUID();
    await db.insert(categories).values({ ...category, id });
    const [newCategory] = await db.select().from(categories).where(eq(categories.id, id));
    return newCategory;
  }

  async updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category> {
    await db
      .update(categories)
      .set({ ...category, updatedAt: new Date() })
      .where(eq(categories.id, id));
    
    const [updated] = await db.select().from(categories).where(eq(categories.id, id));
    return updated;
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  async upsertCategory(category: InsertCategory): Promise<Category> {
    const id = crypto.randomUUID();
    const slug = category.slug;
    
    // Check if category with this slug exists
    const [existing] = await db.select().from(categories).where(eq(categories.slug, slug));
    
    if (existing) {
      // Update existing
      await db
        .update(categories)
        .set({
          name: category.name,
          description: category.description,
          color: category.color,
          updatedAt: new Date(),
        })
        .where(eq(categories.slug, slug));
      
      const [updated] = await db.select().from(categories).where(eq(categories.slug, slug));
      return updated;
    } else {
      // Insert new
      await db.insert(categories).values({ ...category, id });
      const [newCategory] = await db.select().from(categories).where(eq(categories.id, id));
      return newCategory;
    }
  }

  async deleteCategoryCascade(id: string, options?: { dryRun?: boolean }): Promise<{
    subcategoriesAffected: number;
    documentsUpdated: number;
    success: boolean;
  }> {
    return await db.transaction(async (tx) => {
      // First, get all subcategories of this category
      const subcategoriesResult = await tx
        .select()
        .from(subcategories)
        .where(eq(subcategories.categoryId, id));

      const subcategoryIds = subcategoriesResult.map(sub => sub.id);

      // Count documents that will be affected
      const documentsWithCategory = await tx
        .select({ count: count() })
        .from(documents)
        .where(eq(documents.categoryId, id));

      const documentsWithSubcategories = subcategoryIds.length > 0 
        ? await tx
          .select({ count: count() })
          .from(documents)
          .where(inArray(documents.subcategoryId, subcategoryIds))
        : [{ count: 0 }];

      const totalDocumentsUpdated = documentsWithCategory[0].count + documentsWithSubcategories[0].count;

      if (options?.dryRun) {
        return {
          subcategoriesAffected: subcategoriesResult.length,
          documentsUpdated: totalDocumentsUpdated,
          success: true,
        };
      }

      // Update documents: set subcategoryId to null for those referencing subcategories of this category
      if (subcategoryIds.length > 0) {
        await tx
          .update(documents)
          .set({ subcategoryId: null, updatedAt: new Date() })
          .where(inArray(documents.subcategoryId, subcategoryIds));
      }

      // Update documents: set categoryId to null for those referencing this category
      await tx
        .update(documents)
        .set({ categoryId: null, updatedAt: new Date() })
        .where(eq(documents.categoryId, id));

      // Delete subcategories (this will cascade due to FK constraint)
      if (subcategoryIds.length > 0) {
        await tx
          .delete(subcategories)
          .where(eq(subcategories.categoryId, id));
      }

      // Finally, delete the category
      await tx
        .delete(categories)
        .where(eq(categories.id, id));

      return {
        subcategoriesAffected: subcategoriesResult.length,
        documentsUpdated: totalDocumentsUpdated,
        success: true,
      };
    });
  }

  // Subcategory operations
  async getSubcategories(categoryId?: string): Promise<Subcategory[]> {
    const query = db.select().from(subcategories);
    if (categoryId) {
      return await query.where(eq(subcategories.categoryId, categoryId)).orderBy(asc(subcategories.name));
    }
    return await query.orderBy(asc(subcategories.name));
  }

  async getSubcategoryById(id: string): Promise<Subcategory | undefined> {
    const [subcategory] = await db.select().from(subcategories).where(eq(subcategories.id, id));
    return subcategory;
  }

  async createSubcategory(subcategory: InsertSubcategory): Promise<Subcategory> {
    const id = crypto.randomUUID();
    await db.insert(subcategories).values({ ...subcategory, id });
    const [newSubcategory] = await db.select().from(subcategories).where(eq(subcategories.id, id));
    return newSubcategory;
  }

  async updateSubcategory(id: string, subcategory: Partial<InsertSubcategory>): Promise<Subcategory> {
    await db
      .update(subcategories)
      .set({ ...subcategory, updatedAt: new Date() })
      .where(eq(subcategories.id, id));
    
    const [updatedSubcategory] = await db.select().from(subcategories).where(eq(subcategories.id, id));
    return updatedSubcategory;
  }

  async deleteSubcategory(id: string): Promise<void> {
    await db.delete(subcategories).where(eq(subcategories.id, id));
  }

  async upsertSubcategory(subcategory: InsertSubcategory): Promise<Subcategory> {
    // Check if subcategory already exists by slug and categoryId
    const [existing] = await db
      .select()
      .from(subcategories)
      .where(
        and(
          eq(subcategories.slug, subcategory.slug),
          eq(subcategories.categoryId, subcategory.categoryId!)
        )
      );

    if (existing) {
      // Update existing subcategory
      await db
        .update(subcategories)
        .set({
          name: subcategory.name,
          description: subcategory.description,
          updatedAt: new Date(),
        })
        .where(eq(subcategories.id, existing.id));
      
      const [updated] = await db.select().from(subcategories).where(eq(subcategories.id, existing.id));
      return updated;
    } else {
      // Create new subcategory
      const id = crypto.randomUUID();
      await db.insert(subcategories).values({ ...subcategory, id });
      const [newSubcategory] = await db.select().from(subcategories).where(eq(subcategories.id, id));
      return newSubcategory;
    }
  }

  async seedPredefinedCategories(): Promise<void> {
    // Controlla se ci sono già categorie nel database
    const existingCategories = await this.getCategories();
    
    if (existingCategories.length > 0) {
      console.log("✅ Categories already seeded, skipping...");
      return;
    }

    const { PREDEFINED_CATEGORIES } = await import("@shared/schema");

    console.log("🌱 Seeding predefined categories...");

    for (const categoryData of PREDEFINED_CATEGORIES) {
      // Create/update category
      const category = await this.upsertCategory({
        name: categoryData.name,
        slug: categoryData.slug,
        description: categoryData.description,
        color: categoryData.color,
      });

      console.log(`✅ Category: ${category.name}`);

      // Create/update subcategories
      for (const subcategoryData of categoryData.subcategories) {
        const subcategory = await this.upsertSubcategory({
          name: subcategoryData.name,
          slug: subcategoryData.slug,
          description: subcategoryData.description,
          categoryId: category.id,
        });

        console.log(`  ↳ Subcategory: ${subcategory.name}`);
      }
    }

    console.log("🎉 Predefined categories seeded successfully!");
  }

  // Maintenance operations
  async fixManoscrittiInconsistency(options?: { dryRun?: boolean }): Promise<{
    documentsReassigned: number;
    subcategoriesDeleted: number;
    categoryDeleted: boolean;
    success: boolean;
  }> {
    return await db.transaction(async (tx) => {
      // Find the invalid "manoscritti" category (should be a subcategory)
      const [invalidCategory] = await tx
        .select()
        .from(categories)
        .where(eq(categories.slug, "manoscritti"));

      if (!invalidCategory) {
        // No inconsistency found, return success with zero impact
        return {
          documentsReassigned: 0,
          subcategoriesDeleted: 0,
          categoryDeleted: false,
          success: true,
        };
      }

      // Find the correct Biblioteca category
      const [bibliotecaCategory] = await tx
        .select()
        .from(categories)
        .where(eq(categories.slug, "biblioteca"));

      if (!bibliotecaCategory) {
        throw new Error("Biblioteca category not found - cannot proceed with fix");
      }

      // Find the correct manoscritti subcategory under Biblioteca
      const [manoscrittisSubcategory] = await tx
        .select()
        .from(subcategories)
        .where(
          and(
            eq(subcategories.slug, "manoscritti"),
            eq(subcategories.categoryId, bibliotecaCategory.id)
          )
        );

      if (!manoscrittisSubcategory) {
        throw new Error("Manoscritti subcategory under Biblioteca not found - cannot proceed with fix");
      }

      // Get subcategories of the invalid category
      const invalidSubcategories = await tx
        .select()
        .from(subcategories)
        .where(eq(subcategories.categoryId, invalidCategory.id));

      const invalidSubcategoryIds = invalidSubcategories.map(sub => sub.id);

      // Count documents that reference the invalid category
      const docsWithInvalidCategory = await tx
        .select({ count: count() })
        .from(documents)
        .where(eq(documents.categoryId, invalidCategory.id));

      // Count documents that reference invalid subcategories
      const docsWithInvalidSubcategories = invalidSubcategoryIds.length > 0 
        ? await tx
          .select({ count: count() })
          .from(documents)
          .where(inArray(documents.subcategoryId, invalidSubcategoryIds))
        : [{ count: 0 }];

      const totalDocsToReassign = docsWithInvalidCategory[0].count + docsWithInvalidSubcategories[0].count;

      if (options?.dryRun) {
        return {
          documentsReassigned: totalDocsToReassign,
          subcategoriesDeleted: invalidSubcategories.length,
          categoryDeleted: true,
          success: true,
        };
      }

      // Reassign documents from invalid category to Biblioteca > manoscritti
      if (docsWithInvalidCategory[0].count > 0) {
        await tx
          .update(documents)
          .set({ 
            categoryId: bibliotecaCategory.id, 
            subcategoryId: manoscrittisSubcategory.id,
            updatedAt: new Date() 
          })
          .where(eq(documents.categoryId, invalidCategory.id));
      }

      // Reassign documents that reference invalid subcategories to Biblioteca > manoscritti
      if (invalidSubcategoryIds.length > 0) {
        await tx
          .update(documents)
          .set({ 
            categoryId: bibliotecaCategory.id, 
            subcategoryId: manoscrittisSubcategory.id,
            updatedAt: new Date() 
          })
          .where(inArray(documents.subcategoryId, invalidSubcategoryIds));
      }

      // Delete invalid subcategories
      if (invalidSubcategoryIds.length > 0) {
        await tx
          .delete(subcategories)
          .where(eq(subcategories.categoryId, invalidCategory.id));
      }

      // Delete the invalid manoscritti category
      await tx
        .delete(categories)
        .where(eq(categories.id, invalidCategory.id));

      return {
        documentsReassigned: totalDocsToReassign,
        subcategoriesDeleted: invalidSubcategories.length,
        categoryDeleted: true,
        success: true,
      };
    });
  }

  // Document relations operations
  async getDocumentRelations(documentId: string): Promise<DocumentRelation[]> {
    return await db
      .select()
      .from(documentRelations)
      .where(
        or(
          eq(documentRelations.fromDocumentId, documentId),
          eq(documentRelations.toDocumentId, documentId)
        )
      )
      .orderBy(asc(documentRelations.createdAt));
  }

  async createDocumentRelation(relation: InsertDocumentRelation): Promise<DocumentRelation> {
    const id = crypto.randomUUID();
    await db.insert(documentRelations).values({ ...relation, id });
    const [newRelation] = await db.select().from(documentRelations).where(eq(documentRelations.id, id));
    return newRelation;
  }

  async deleteDocumentRelation(relationId: string): Promise<void> {
    await db.delete(documentRelations).where(eq(documentRelations.id, relationId));
  }

  // Document operations
  async getDocuments(params: SearchDocuments): Promise<{ documents: Document[]; total: number }> {
    const { page, limit, query, categoryId, subcategoryId, period, format, tags, isPublic, status, sortBy, sortOrder } = params;
    const offset = (page - 1) * limit;

    let whereConditions = [];

    if (query) {
      whereConditions.push(
        or(
          like(documents.title, `%${query}%`),
          like(documents.description, `%${query}%`),
          like(documents.author, `%${query}%`),
          like(documents.location, `%${query}%`)
        )
      );
    }

    if (categoryId) {
      whereConditions.push(eq(documents.categoryId, categoryId));
    }

    if (subcategoryId) {
      whereConditions.push(eq(documents.subcategoryId, subcategoryId));
    }

    if (period) {
      whereConditions.push(eq(documents.period, period));
    }

    if (format) {
      if (format === "images") {
        whereConditions.push(like(documents.mimeType, "image/%"));
      } else if (format === "documents") {
        whereConditions.push(like(documents.mimeType, "application/%"));
      }
    }

    if (isPublic !== undefined) {
      whereConditions.push(eq(documents.isPublic, isPublic));
    }

    if (status) {
      whereConditions.push(eq(documents.status, status));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(documents)
      .where(whereClause);

    // Get documents with sorting
    const sortColumnMap = {
      'createdAt': documents.createdAt,
      'title': documents.title,
      'dateCreated': documents.dateCreated,
      'updatedAt': documents.updatedAt,
    } as const;
    
    const sortColumn = sortColumnMap[sortBy as keyof typeof sortColumnMap] || documents.createdAt;
    const orderByClause = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);
    
    const documentResults = await db
      .select()
      .from(documents)
      .where(whereClause)
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    return {
      documents: documentResults,
      total: totalResult.count,
    };
  }

  async getDocumentById(id: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document;
  }

  async getDocumentByArchiveCode(code: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.archiveCode, code));
    return document;
  }

  async getDocumentByManifestId(manifestId: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.iiifManifestId, manifestId));
    return document;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const id = crypto.randomUUID();
    await db.insert(documents).values({ ...document, id });
    const [newDocument] = await db.select().from(documents).where(eq(documents.id, id));
    return newDocument;
  }

  async updateDocument(id: string, document: UpdateDocument): Promise<Document> {
    await db
      .update(documents)
      .set({ ...document, updatedAt: new Date() })
      .where(eq(documents.id, id));
    
    const [updatedDocument] = await db.select().from(documents).where(eq(documents.id, id));
    return updatedDocument;
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async getStats(): Promise<{
    totalDocuments: number;
    totalImages: number;
    totalCategories: number;
    todayUploads: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalDocsResult] = await db.select({ count: count() }).from(documents);

    const [totalImagesResult] = await db
      .select({ count: count() })
      .from(documents)
      .where(like(documents.mimeType, "image/%"));

    const [totalCategoriesResult] = await db.select({ count: count() }).from(categories);

    const [todayUploadsResult] = await db
      .select({ count: count() })
      .from(documents)
      .where(sql`DATE(${documents.createdAt}) = DATE(${today})`);

    return {
      totalDocuments: totalDocsResult.count,
      totalImages: totalImagesResult.count,
      totalCategories: totalCategoriesResult.count,
      todayUploads: todayUploadsResult.count,
    };
  }
}

export const storage = new DatabaseStorage();