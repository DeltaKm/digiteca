export interface UploadOptions {
  categoryName?: string;
  subcategoryName?: string;
  filename?: string;
  mimeType?: string;
}

export interface StorageUploadResult {
  path: string;
  url: string;
}
