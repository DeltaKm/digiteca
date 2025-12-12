import { randomUUID } from "crypto";
import type { Response as ExpressResponse } from "express";
import { Storage, type Bucket, type File } from "@google-cloud/storage";
import { FtpStorageService } from "./ftpStorage";
import type { UploadOptions, StorageUploadResult } from "./storageTypes";

export interface StorageProvider {
  uploadBuffer(buffer: Buffer, options?: UploadOptions): Promise<StorageUploadResult>;
  streamFileToResponse(
    filePath: string,
    res: ExpressResponse,
    options?: { contentType?: string; cacheControl?: string }
  ): Promise<void>;
  downloadToBuffer(filePath: string): Promise<Buffer>;
  deleteFile(filePath: string): Promise<void>;
}

let cachedProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!cachedProvider) {
    const provider = (process.env.STORAGE_PROVIDER || "ftp").toLowerCase();
    cachedProvider = provider === "gcs" ? new GcsStorageProvider() : new FtpStorageProvider();
  }

  return cachedProvider!;
}

class FtpStorageProvider implements StorageProvider {
  private service: FtpStorageService;

  constructor() {
    this.service = new FtpStorageService();
  }

  async uploadBuffer(buffer: Buffer, options: UploadOptions = {}): Promise<StorageUploadResult> {
    return this.service.uploadFromBuffer(buffer, options);
  }

  async streamFileToResponse(
    filePath: string,
    res: ExpressResponse,
    options?: { contentType?: string; cacheControl?: string }
  ): Promise<void> {
    if (options?.contentType) {
      res.setHeader("Content-Type", options.contentType);
    }
    if (options?.cacheControl) {
      res.setHeader("Cache-Control", options.cacheControl);
    }
    await this.service.downloadFileToResponse(filePath, res);
  }

  async downloadToBuffer(filePath: string): Promise<Buffer> {
    return this.service.downloadToBuffer(filePath);
  }

  async deleteFile(filePath: string): Promise<void> {
    await this.service.deleteFile(filePath);
  }
}

class GcsStorageProvider implements StorageProvider {
  private storage: Storage;
  private bucket: Bucket;
  private basePath: string;

  constructor() {
    const bucketName = process.env.GCS_BUCKET;
    if (!bucketName) {
      throw new Error("GCS_BUCKET env var is required when STORAGE_PROVIDER=gcs");
    }

    this.storage = new Storage({
      projectId: process.env.GCS_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
    this.bucket = this.storage.bucket(bucketName);
    this.basePath = process.env.STORAGE_BASE_PATH || "assets/digiteka";
  }

  async uploadBuffer(buffer: Buffer, options: UploadOptions = {}): Promise<StorageUploadResult> {
    const objectPath = this.generateFilePath(options);
    const file = this.bucket.file(objectPath);

    await file.save(buffer, {
      resumable: false,
      contentType: options.mimeType || "application/octet-stream",
    });

    return {
      path: objectPath,
      url: `gs://${this.bucket.name}/${objectPath}`,
    };
  }

  async streamFileToResponse(
    filePath: string,
    res: ExpressResponse,
    options?: { contentType?: string; cacheControl?: string }
  ): Promise<void> {
    const file = this.getFile(filePath);
    const [exists] = await file.exists();
    if (!exists) {
      throw new Error(`File ${filePath} not found in bucket ${this.bucket.name}`);
    }

    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", options?.contentType || metadata.contentType || "application/octet-stream");
    res.setHeader("Cache-Control", options?.cacheControl || "public, max-age=31536000");

    await new Promise<void>((resolve, reject) => {
      file
        .createReadStream()
        .on("error", (error) => {
          reject(error);
        })
        .on("end", () => resolve())
        .pipe(res);
    });
  }

  async downloadToBuffer(filePath: string): Promise<Buffer> {
    const file = this.getFile(filePath);
    const [contents] = await file.download();
    return contents;
  }

  async deleteFile(filePath: string): Promise<void> {
    const file = this.getFile(filePath);
    const [exists] = await file.exists();
    if (!exists) {
      return;
    }
    await file.delete();
  }

  private getFile(filePath: string): File {
    const normalizedPath = filePath.replace(/^\/+/, "");
    return this.bucket.file(normalizedPath);
  }

  private generateFilePath(options: UploadOptions = {}): string {
    const filename = options.filename || randomUUID();
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_-]/g, "")
        .substring(0, 50);

    const segments = [this.basePath];

    if (options.categoryName) {
      segments.push(normalize(options.categoryName));
      if (options.subcategoryName) {
        segments.push(normalize(options.subcategoryName));
      }
    } else {
      segments.push("general");
    }

    segments.push(year, month, filename);
    return segments.join("/");
  }
}
