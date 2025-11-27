import sharp from 'sharp';
import { ObjectStorageService, ObjectNotFoundError } from './objectStorage';
import { FtpStorageService } from './ftpStorage';
import { storage } from './storage';
import { PassThrough } from 'stream';
import type { Response } from 'express';

export interface IIIFImageInfo {
  '@context': string;
  '@id': string;
  protocol: string;
  width: number;
  height: number;
  profile: (string | { formats: string[]; qualities: string[]; supports: string[] })[];
  tiles: { width: number; height: number; scaleFactors: number[] }[];
  service?: {
    '@context': string;
    '@id': string;
    profile: string;
  };
}

export interface IIIFRegion {
  type: 'full' | 'square' | 'pixel' | 'percent';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface IIIFSize {
  type: 'full' | 'max' | 'width' | 'height' | 'percent' | 'pixel' | 'bestfit';
  width?: number;
  height?: number;
  percent?: number;
}

export interface IIIFRotation {
  mirror: boolean;
  degrees: number;
}

export interface IIIFQuality {
  type: 'default' | 'color' | 'gray' | 'bitonal';
}

export class IIIFService {
  private objectStorageService: ObjectStorageService;
  private imageCache: Map<string, { buffer: Buffer; metadata: sharp.Metadata; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.objectStorageService = new ObjectStorageService();
  }

  /**
   * Get image buffer and metadata from cache or load from FTP storage
   */
  private async getImageData(filePath: string): Promise<{ buffer: Buffer; metadata: sharp.Metadata }> {
    const cacheKey = filePath;
    const cached = this.imageCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return { buffer: cached.buffer, metadata: cached.metadata };
    }

    try {
      console.log(`📥 IIIF: Loading image from FTP: ${filePath}`);
      
      const ftpService = new FtpStorageService();
      const client = await (ftpService as any).connect();
      
      const chunks: Buffer[] = [];
      const passThrough = new PassThrough();
      
      return new Promise(async (resolve, reject) => {
        passThrough.on('data', (chunk: Buffer) => chunks.push(chunk));
        passThrough.on('end', async () => {
          try {
            const buffer = Buffer.concat(chunks);
            const image = sharp(buffer);
            const metadata = await image.metadata();
            
            console.log(`✅ IIIF: Image loaded successfully:`, {
              format: metadata.format,
              width: metadata.width,
              height: metadata.height,
              size: buffer.length
            });
            
            // Cache the result
            this.imageCache.set(cacheKey, { buffer, metadata, timestamp: Date.now() });
            
            client.close();
            resolve({ buffer, metadata });
          } catch (error) {
            console.error(`❌ IIIF: Error processing image:`, error);
            client.close();
            reject(error);
          }
        });
        
        passThrough.on('error', (error) => {
          console.error(`❌ IIIF: Stream error:`, error);
          client.close();
          reject(error);
        });
        
        try {
          await client.downloadTo(passThrough, filePath);
        } catch (error) {
          console.error(`❌ IIIF: FTP download error:`, error);
          client.close();
          reject(error);
        }
      });
    } catch (error) {
      console.error(`❌ IIIF: Failed to load image from ${filePath}:`, error);
      throw new Error(`Failed to load image from ${filePath}: ${error}`);
    }
  }

  /**
   * Generate IIIF info.json response for an image
   */
  async generateImageInfo(documentId: string, baseUrl: string): Promise<IIIFImageInfo> {
    const document = await storage.getDocumentById(documentId);
    if (!document || !document.filePath) {
      throw new Error('Document not found');
    }

    console.log(`Generating IIIF info for document ${documentId}:`, {
      mimeType: document.mimeType,
      filePath: document.filePath,
      fileName: document.fileName
    });

    const { metadata } = await this.getImageData(document.filePath);
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Unable to determine image dimensions');
    }

    // Calculate appropriate tile sizes and scale factors based on image dimensions
    const maxDimension = Math.max(metadata.width, metadata.height);
    const tileSize = 512;
    const scaleFactors: number[] = [];
    
    // Generate scale factors up to the point where the largest dimension becomes smaller than tile size
    let scale = 1;
    while (maxDimension / scale >= tileSize) {
      scaleFactors.push(scale);
      scale *= 2;
    }
    
    // Always include the final scale factor
    if (scaleFactors[scaleFactors.length - 1] !== scale) {
      scaleFactors.push(scale);
    }

    const imageInfo: IIIFImageInfo = {
      '@context': 'http://iiif.io/api/image/2/context.json',
      '@id': baseUrl,
      protocol: 'http://iiif.io/api/image',
      width: metadata.width,
      height: metadata.height,
      profile: [
        'http://iiif.io/api/image/2/level1.json',
        {
          formats: ['jpg', 'png', 'webp'],
          qualities: ['default', 'color', 'gray'],
          supports: [
            'regionByPx',
            'regionByPercent', 
            'sizeByW',
            'sizeByH',
            'sizeByPct',
            'sizeByConfinedWh',
            'sizeByWh',
            'rotationBy90s',
            'mirroring'
          ]
        }
      ],
      tiles: [{
        width: tileSize,
        height: tileSize,
        scaleFactors: scaleFactors
      }]
    };

    return imageInfo;
  }

  /**
   * Parse IIIF region parameter
   */
  private parseRegion(region: string, imageWidth: number, imageHeight: number): IIIFRegion {
    if (region === 'full') {
      return { type: 'full' };
    }
    
    if (region === 'square') {
      return { type: 'square' };
    }
    
    if (region.startsWith('pct:')) {
      const coords = region.slice(4).split(',').map(Number);
      if (coords.length !== 4) {
        throw new Error('Invalid percent region format');
      }
      return {
        type: 'percent',
        x: Math.round((coords[0] / 100) * imageWidth),
        y: Math.round((coords[1] / 100) * imageHeight),
        width: Math.round((coords[2] / 100) * imageWidth),
        height: Math.round((coords[3] / 100) * imageHeight)
      };
    }
    
    const coords = region.split(',').map(Number);
    if (coords.length !== 4) {
      throw new Error('Invalid pixel region format');
    }
    
    return {
      type: 'pixel',
      x: coords[0],
      y: coords[1],
      width: coords[2],
      height: coords[3]
    };
  }

  /**
   * Parse IIIF size parameter
   */
  private parseSize(size: string): IIIFSize {
    if (size === 'full' || size === 'max') {
      return { type: size };
    }
    
    if (size.endsWith('%')) {
      const percent = parseFloat(size.slice(0, -1));
      return { type: 'percent', percent };
    }
    
    if (size.startsWith('!')) {
      const dims = size.slice(1).split(',').map(Number);
      return { type: 'bestfit', width: dims[0], height: dims[1] };
    }
    
    if (size.includes(',')) {
      const [w, h] = size.split(',');
      return {
        type: 'pixel',
        width: w ? parseInt(w) : undefined,
        height: h ? parseInt(h) : undefined
      };
    }
    
    const num = parseInt(size);
    if (size.endsWith(',')) {
      return { type: 'width', width: num };
    } else {
      return { type: 'height', height: num };
    }
  }

  /**
   * Parse IIIF rotation parameter
   */
  private parseRotation(rotation: string): IIIFRotation {
    const mirror = rotation.startsWith('!');
    const degrees = parseFloat(mirror ? rotation.slice(1) : rotation);
    return { mirror, degrees };
  }

  /**
   * Parse IIIF quality parameter
   */
  private parseQuality(quality: string): IIIFQuality {
    const validQualities = ['default', 'color', 'gray', 'bitonal'] as const;
    if (validQualities.includes(quality as any)) {
      return { type: quality as any };
    }
    return { type: 'default' };
  }

  /**
   * Process IIIF image request and return processed image
   */
  async processImageRequest(
    documentId: string,
    regionParam: string,
    sizeParam: string,
    rotationParam: string,
    qualityParam: string,
    format: string,
    res: Response
  ): Promise<void> {
    const document = await storage.getDocumentById(documentId);
    if (!document || !document.filePath) {
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    try {
      const { buffer, metadata } = await this.getImageData(document.filePath);
      
      if (!metadata.width || !metadata.height) {
        res.status(500).json({ error: 'Unable to process image' });
        return;
      }

      let image = sharp(buffer);
      
      // Parse parameters
      const region = this.parseRegion(regionParam, metadata.width, metadata.height);
      const size = this.parseSize(sizeParam);
      const rotation = this.parseRotation(rotationParam);
      const quality = this.parseQuality(qualityParam);

      // Apply region cropping
      if (region.type === 'square') {
        const minDim = Math.min(metadata.width, metadata.height);
        const x = Math.floor((metadata.width - minDim) / 2);
        const y = Math.floor((metadata.height - minDim) / 2);
        image = image.extract({ left: x, top: y, width: minDim, height: minDim });
      } else if (region.type === 'pixel' || region.type === 'percent') {
        const x = Math.max(0, region.x || 0);
        const y = Math.max(0, region.y || 0);
        const width = Math.min(region.width || metadata.width, metadata.width - x);
        const height = Math.min(region.height || metadata.height, metadata.height - y);
        
        if (width > 0 && height > 0) {
          image = image.extract({ left: x, top: y, width, height });
        }
      }

      // Get current dimensions after cropping
      const currentMetadata = await image.metadata();
      const currentWidth = currentMetadata.width || metadata.width;
      const currentHeight = currentMetadata.height || metadata.height;

      // Apply sizing
      if (size.type === 'width' && size.width) {
        image = image.resize(size.width, null, { withoutEnlargement: false });
      } else if (size.type === 'height' && size.height) {
        image = image.resize(null, size.height, { withoutEnlargement: false });
      } else if (size.type === 'pixel' && (size.width || size.height)) {
        image = image.resize(size.width || null, size.height || null, { withoutEnlargement: false });
      } else if (size.type === 'percent' && size.percent) {
        const newWidth = Math.round(currentWidth * (size.percent / 100));
        const newHeight = Math.round(currentHeight * (size.percent / 100));
        image = image.resize(newWidth, newHeight, { withoutEnlargement: false });
      } else if (size.type === 'bestfit' && size.width && size.height) {
        image = image.resize(size.width, size.height, { 
          fit: 'inside',
          withoutEnlargement: false 
        });
      }

      // Apply rotation and mirroring
      if (rotation.mirror) {
        image = image.flop();
      }
      
      if (rotation.degrees !== 0) {
        // Sharp only supports 90-degree increments natively
        const normalizedDegrees = ((rotation.degrees % 360) + 360) % 360;
        if (normalizedDegrees === 90) {
          image = image.rotate(90);
        } else if (normalizedDegrees === 180) {
          image = image.rotate(180);
        } else if (normalizedDegrees === 270) {
          image = image.rotate(270);
        } else if (normalizedDegrees !== 0) {
          // For arbitrary angles, use rotate with background
          image = image.rotate(rotation.degrees, { background: '#ffffff' });
        }
      }

      // Apply quality/color transformations
      if (quality.type === 'gray') {
        image = image.grayscale();
      }
      // Note: bitonal would require more complex processing

      // Convert to requested format
      let outputBuffer: Buffer;
      let contentType: string;
      
      switch (format.toLowerCase()) {
        case 'jpg':
        case 'jpeg':
          outputBuffer = await image.jpeg({ quality: 90 }).toBuffer();
          contentType = 'image/jpeg';
          break;
        case 'png':
          outputBuffer = await image.png().toBuffer();
          contentType = 'image/png';
          break;
        case 'webp':
          outputBuffer = await image.webp({ quality: 90 }).toBuffer();
          contentType = 'image/webp';
          break;
        default:
          outputBuffer = await image.jpeg({ quality: 90 }).toBuffer();
          contentType = 'image/jpeg';
      }

      // Set response headers
      res.set({
        'Content-Type': contentType,
        'Content-Length': outputBuffer.length.toString(),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      });

      res.send(outputBuffer);
    } catch (error) {
      console.error('Error processing IIIF image request:', error);
      res.status(500).json({ error: 'Failed to process image request' });
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of Array.from(this.imageCache.entries())) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.imageCache.delete(key);
      }
    }
  }

  /**
   * Initialize cleanup timer
   */
  public startCleanupTimer(): void {
    setInterval(() => this.cleanupCache(), this.CACHE_TTL);
  }
}

export const iiifService = new IIIFService();