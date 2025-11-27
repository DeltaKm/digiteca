import { storage } from "./storage";
import { ObjectStorageService } from "./objectStorage";
import { randomUUID } from "crypto";
import path from "path";

export interface IIIFManifest {
  '@context': string;
  '@type': string;
  '@id': string;
  label: string;
  description?: string;
  attribution?: string;
  license?: string;
  logo?: string;
  related?: string;
  seeAlso?: string;
  within?: string;
  sequences: Array<{
    '@type': string;
    '@id': string;
    label: string;
    canvases: Array<{
      '@type': string;
      '@id': string;
      label: string;
      description?: string;
      width: number;
      height: number;
      images: Array<{
        '@type': string;
        '@id': string;
        motivation: string;
        resource: {
          '@type': string;
          '@id': string;
          width: number;
          height: number;
          format: string;
        };
        on: string;
      }>;
    }>;
  }>;
}

export class ManifestService {
  private objectStorageService: ObjectStorageService;

  constructor() {
    this.objectStorageService = new ObjectStorageService();
  }

  /**
   * Save a IIIF Manifest to object storage
   */
  async saveManifest(
    manifest: IIIFManifest,
    userId: string,
    imageUrls?: string[],
    documentData?: {
      title?: string;
      description?: string;
      categoryId?: string;
      subcategoryId?: string;
      status?: string;
      isPublic?: boolean;
      tags?: string[];
      keywords?: string[];
    }
  ): Promise<{
    manifestId: string;
    manifestUrl: string;
    objectPath: string;
  }> {
    const manifestId = randomUUID();
    const fileName = `manifest-${manifestId}.json`;

    // Generate the manifest JSON content
    const manifestContent = JSON.stringify(manifest, null, 2);

    try {
      // Get upload URL for the manifest
      const uploadUrl = await this.objectStorageService.getObjectEntityUploadURL();

      // Upload the manifest file
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: manifestContent,
      });

      if (!response.ok) {
        throw new Error(`Failed to upload manifest: ${response.status}`);
      }

      // Set ACL policy for the manifest
      const objectPath = await this.objectStorageService.trySetObjectEntityAclPolicy(uploadUrl, {
        owner: userId,
        visibility: "public",
        aclRules: [
          {
            group: { type: "PUBLIC" as any, id: "public" },
            permission: "read" as any
          }
        ]
      });

      // Count the number of pages/canvases in the manifest
      const canvasCount = manifest.sequences?.[0]?.canvases?.length || 0;

      // Prepare document data, using undefined instead of null for optional fields
      const docToCreate: any = {
        title: documentData?.title || `${manifest.label} (Manifest IIIF - ${canvasCount} ${canvasCount === 1 ? 'pagina' : 'pagine'})`,
        description: documentData?.description || manifest.description || `Manifest IIIF contenente ${canvasCount} ${canvasCount === 1 ? 'immagine' : 'immagini'}`,
        author: manifest.attribution || "",
        period: "",
        location: "",
        status: documentData?.status || "published",
        isPublic: documentData?.isPublic ?? true,
        tags: documentData?.tags || [],
        keywords: documentData?.keywords || [],
        archiveCode: `MF-${manifestId.slice(0, 8).toUpperCase()}`,
        uploadedBy: userId,
        filePath: objectPath,
        fileName: fileName,
        originalFileName: fileName,
        fileSize: Buffer.byteLength(manifestContent, 'utf8'),
        mimeType: "application/json",
        iiifManifestId: manifestId, // Store full manifestId for precise lookup
        iiifManifestUrl: `/api/manifests/${manifestId}`,
      };

      // Only add categoryId and subcategoryId if they are provided (use undefined instead of null)
      if (documentData?.categoryId) {
        docToCreate.categoryId = documentData.categoryId;
      }
      if (documentData?.subcategoryId) {
        docToCreate.subcategoryId = documentData.subcategoryId;
      }

      // Create a document record for the manifest
      await storage.createDocument(docToCreate);

      const manifestUrl = `/api/manifests/${manifestId}`;

      console.log(`✅ Created IIIF Manifest: ${manifest.label} with ${canvasCount} pages`);

      return {
        manifestId,
        manifestUrl,
        objectPath,
      };
    } catch (error) {
      console.error('Error saving manifest:', error);
      throw new Error(`Failed to save manifest: ${error}`);
    }
  }

  /**
   * Get a manifest by ID
   */
  async getManifest(manifestId: string): Promise<IIIFManifest | null> {
    try {
      console.log(`🔍 Searching for manifest with ID: ${manifestId}`);

      // Try precise lookup by manifestId first (for new manifests)
      let manifestDoc = await storage.getDocumentByManifestId(manifestId);

      // Fallback to archiveCode lookup for old manifests
      if (!manifestDoc) {
        console.log(`📄 Not found by manifestId, trying archiveCode fallback...`);
        const archiveCode = `MF-${manifestId.slice(0, 8).toUpperCase()}`;
        manifestDoc = await storage.getDocumentByArchiveCode(archiveCode);
      }

      if (manifestDoc) {
        console.log(`✅ Found manifest document: ${manifestDoc.title} (ID: ${manifestDoc.iiifManifestId || manifestDoc.archiveCode})`);
      } else {
        console.log(`❌ No matching manifest document found for ID: ${manifestId}`);
      }

      if (!manifestDoc || !manifestDoc.filePath) {
        return null;
      }

      // Get the manifest file from storage
      const objectFile = await this.objectStorageService.getObjectEntityFile(manifestDoc.filePath);

      // Read the manifest content
      const chunks: Buffer[] = [];
      const stream = objectFile.createReadStream();

      return new Promise(async (resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', async () => {
          try {
            const content = Buffer.concat(chunks).toString('utf8');
            let manifest = JSON.parse(content) as IIIFManifest;

            // Get current domain for URL fixing
            const replitDomain = process.env.REPLIT_DOMAINS?.split(',')[0];
            const baseUrl = replitDomain
              ? `https://${replitDomain}`
              : 'http://localhost:5000';

            console.log(`🔧 Fixing manifest URLs for domain: ${baseUrl}`);

            // Fix URLs in manifest
            if (manifest['@id']) {
              // Fix manifest ID to use current domain
              manifest['@id'] = manifest['@id'].replace(/https:\/\/[^\/]+/, baseUrl);
            }

            if (manifest.sequences) {
              for (const sequence of manifest.sequences) {
                // Fix sequence ID
                if (sequence['@id']) {
                  sequence['@id'] = sequence['@id'].replace(/https:\/\/[^\/]+/, baseUrl);
                }

                if (sequence.canvases) {
                  for (const canvas of sequence.canvases) {
                    // Fix canvas ID
                    if (canvas['@id']) {
                      canvas['@id'] = canvas['@id'].replace(/https:\/\/[^\/]+/, baseUrl);
                    }

                    if (canvas.images) {
                      for (const image of canvas.images) {
                        // Fix annotation ID
                        if (image['@id']) {
                          image['@id'] = image['@id'].replace(/https:\/\/[^\/]+/, baseUrl);
                        }

                        // Fix the 'on' property
                        if (image.on) {
                          image.on = image.on.replace(/https:\/\/[^\/]+/, baseUrl);
                        }

                        if (image.resource && image.resource['@id']) {
                          const imageUrl = image.resource['@id'];

                          // Check if this is a Google Cloud Storage URL that might be expired
                          if (imageUrl.includes('storage.googleapis.com') && imageUrl.includes('X-Goog-')) {
                            console.log(`🔄 Found potentially expired signed URL, checking...`);

                            try {
                              // Try to access the URL to see if it's still valid
                              const testResponse = await fetch(imageUrl, { method: 'HEAD' });
                              if (!testResponse.ok) {
                                console.log(`❌ Expired URL detected (${testResponse.status}), trying to regenerate...`);

                                // Try to find and regenerate a working URL for this image
                                try {
                                  // Extract the object path from the original URL
                                  const urlParts = imageUrl.split('/');
                                  const fileName = urlParts[urlParts.length - 1]?.split('?')[0];
                                  
                                  if (fileName) {
                                    // Try to find a document with this image in our database
                                    const allDocs = await storage.getDocuments({ 
                                      limit: 1000, 
                                      page: 1, 
                                      sortBy: "createdAt", 
                                      sortOrder: "desc" 
                                    });
                                    
                                    const imageDoc = allDocs.documents.find(doc => 
                                      doc.fileName === fileName || 
                                      doc.originalFileName === fileName ||
                                      doc.filePath?.includes(fileName)
                                    );
                                    
                                    if (imageDoc && imageDoc.filePath) {
                                      console.log(`🔧 Found matching document for ${fileName}, using internal path`);
                                      // Use our internal object serving endpoint
                                      image.resource['@id'] = `${baseUrl}${imageDoc.filePath}`;
                                    } else {
                                      console.warn(`⚠️ Could not find matching document for ${fileName}, keeping original URL`);
                                    }
                                  }
                                } catch (regenerateError) {
                                  console.warn(`⚠️ Error trying to regenerate URL: ${regenerateError}`);
                                }
                              }
                            } catch (urlCheckError) {
                              console.warn(`⚠️ Could not verify image URL: ${urlCheckError}`);
                              
                              // Try to regenerate even if we can't check the URL
                              try {
                                const urlParts = imageUrl.split('/');
                                const fileName = urlParts[urlParts.length - 1]?.split('?')[0];
                                
                                if (fileName) {
                                  const allDocs = await storage.getDocuments({ 
                                    limit: 1000, 
                                    page: 1, 
                                    sortBy: "createdAt", 
                                    sortOrder: "desc" 
                                  });
                                  
                                  const imageDoc = allDocs.documents.find(doc => 
                                    doc.fileName === fileName || 
                                    doc.originalFileName === fileName ||
                                    doc.filePath?.includes(fileName)
                                  );
                                  
                                  if (imageDoc && imageDoc.filePath) {
                                    console.log(`🔧 Using internal path for ${fileName} (couldn't verify original)`);
                                    image.resource['@id'] = `${baseUrl}${imageDoc.filePath}`;
                                  }
                                }
                              } catch (fallbackError) {
                                console.warn(`⚠️ Fallback URL generation failed: ${fallbackError}`);
                              }
                            }
                          }

                          // Convert relative URLs to absolute using current domain
                          if (!imageUrl.startsWith('http')) {
                            image.resource['@id'] = `${baseUrl}${imageUrl}`;
                          }
                        }
                      }
                    }
                  }
                }
              }
            }

            console.log(`✅ Manifest URLs fixed for ${manifest.label}`);
            resolve(manifest);
          } catch (error) {
            console.error('❌ Error processing manifest:', error);
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('Error getting manifest:', error);
      return null;
    }
  }

  /**
   * List all manifests
   */
  async listManifests(): Promise<Array<{
    id: string;
    title: string;
    description?: string;
    createdAt: Date;
    manifestUrl: string;
  }>> {
    try {
      const documents = await storage.getDocuments({
        query: "MF-",
        isPublic: true,
        status: "published",
        limit: 100,
        page: 1,
        sortBy: "createdAt",
        sortOrder: "desc"
      });

      const manifests = documents.documents
        .filter(doc => doc.mimeType === "application/json" && doc.archiveCode?.startsWith("MF-"))
        .map(doc => {
          const manifestId = doc.archiveCode?.replace("MF-", "") || "";
          return {
            id: manifestId,
            title: doc.title,
            description: doc.description || undefined,
            createdAt: doc.createdAt || new Date(),
            manifestUrl: doc.iiifManifestUrl || `/api/manifests/${manifestId}`,
          };
        });

      return manifests;
    } catch (error) {
      console.error('Error listing manifests:', error);
      return [];
    }
  }

  /**
   * Delete a manifest
   */
  async deleteManifest(manifestId: string, userId: string): Promise<boolean> {
    try {
      const documents = await storage.getDocuments({
        query: `MF-${manifestId.slice(0, 8).toUpperCase()}`,
        limit: 1,
        page: 1,
        sortBy: "createdAt",
        sortOrder: "desc"
      });

      const manifestDoc = documents.documents.find(doc =>
        doc.archiveCode?.startsWith(`MF-${manifestId.slice(0, 8).toUpperCase()}`) &&
        doc.mimeType === "application/json"
      );

      if (!manifestDoc) {
        return false;
      }

      // Check ownership
      if (manifestDoc.uploadedBy !== userId) {
        throw new Error("Access denied");
      }

      // Delete the document record
      await storage.deleteDocument(manifestDoc.id);

      return true;
    } catch (error) {
      console.error('Error deleting manifest:', error);
      return false;
    }
  }
}

export const manifestService = new ManifestService();