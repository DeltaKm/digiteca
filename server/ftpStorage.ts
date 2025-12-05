import { Client as FTPClient } from "basic-ftp";
import { randomUUID } from "crypto";
import { Readable } from "stream";

export interface FTPConfig {
  host: string;
  user: string;
  password: string;
  secure?: boolean;
}

export interface UploadOptions {
  categoryName?: string;
  subcategoryName?: string;
  filename?: string;
}

/**
 * FTP Storage Service
 * Gestisce l'upload di file su server FTP remoto
 * Struttura: assets/digiteka/{categoria}/{file}
 */
export class FtpStorageService {
  private config: FTPConfig;

  constructor(config?: FTPConfig) {
    this.config = config || {
      host: process.env.FTP_HOST || "217.160.144.254",
      user: process.env.FTP_USER || "digiteca",
      password: process.env.FTP_PASSWORD || "Digiteca2025-20",
      secure: false, // FTP standard (non FTPS)
    };
  }

  /**
   * Connette al server FTP
   */
  private async connect(): Promise<FTPClient> {
    const client = new FTPClient();
    client.ftp.verbose = process.env.NODE_ENV === "development";
    
    try {
      await client.access({
        host: this.config.host,
        user: this.config.user,
        password: this.config.password,
        secure: this.config.secure,
      });
      return client;
    } catch (error) {
      console.error("FTP connection error:", error);
      throw new Error("Impossibile connettersi al server FTP");
    }
  }

  /**
   * Crea la struttura di cartelle se non esiste
   */
  private async ensureDirectory(client: FTPClient, path: string): Promise<void> {
    try {
      // Splitta il path e crea ogni directory una per volta
      const parts = path.split('/').filter(p => p.length > 0);
      let currentPath = '';
      
      for (const part of parts) {
        currentPath += '/' + part;
        try {
          await client.cd(currentPath);
        } catch (error) {
          // La directory non esiste, proviamo a crearla
          try {
            await client.send('MKD ' + currentPath);
            console.log(`📁 Created directory: ${currentPath}`);
          } catch (mkdError) {
            // Ignora l'errore se la directory esiste già
            console.log(`⚠️ Could not create directory ${currentPath}, it might already exist`);
          }
        }
      }
      
      // Torna alla root
      await client.cd('/');
    } catch (error) {
      console.error(`Error ensuring directory ${path}:`, error);
      // Non lanciamo errore, proviamo comunque a procedere
    }
  }

  /**
   * Normalizza il nome della categoria/sottocategoria per il path
   */
  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, "_") // Spazi -> underscore
      .replace(/[^a-z0-9_-]/g, "") // Rimuovi caratteri speciali
      .substring(0, 50); // Limita lunghezza
  }

  /**
   * Genera il path completo per il file
   * Struttura: assets/digiteka/{categoria}/{sottocategoria}/{anno}/{mese}/{filename}
   */
  private generateFilePath(options: UploadOptions): string {
    const basePath = "assets/digiteka";
    const filename = options.filename || `${randomUUID()}`;
    
    // Ottieni anno e mese corrente
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    
    // Se c'è una categoria, crea la struttura completa
    if (options.categoryName) {
      const categoryPath = this.normalizeName(options.categoryName);
      
      // Se c'è anche una sottocategoria
      if (options.subcategoryName) {
        const subcategoryPath = this.normalizeName(options.subcategoryName);
        return `${basePath}/${categoryPath}/${subcategoryPath}/${year}/${month}/${filename}`;
      }
      
      // Solo categoria (senza sottocategoria)
      return `${basePath}/${categoryPath}/${year}/${month}/${filename}`;
    }
    
    // Se non c'è categoria, salva nella cartella generale con anno/mese
    return `${basePath}/general/${year}/${month}/${filename}`;
  }

  /**
   * Upload di un file dal buffer
   */
  async uploadFromBuffer(
    buffer: Buffer,
    options: UploadOptions = {}
  ): Promise<{ path: string; url: string }> {
    const client = await this.connect();
    
    try {
      const remotePath = this.generateFilePath(options);
      const directory = remotePath.substring(0, remotePath.lastIndexOf("/"));
      
      // Crea la struttura di cartelle
      await this.ensureDirectory(client, directory);
      
      // Upload del file
      const stream = Readable.from(buffer);
      await client.uploadFrom(stream, remotePath);
      
      console.log(`✅ File uploaded to FTP: ${remotePath}`);
      
      // Genera URL pubblico (assumendo che il server FTP sia accessibile via HTTP)
      const publicUrl = `ftp://${this.config.host}/${remotePath}`;
      
      return {
        path: remotePath,
        url: publicUrl,
      };
    } catch (error) {
      console.error("FTP upload error:", error);
      throw new Error("Errore durante l'upload del file su FTP");
    } finally {
      client.close();
    }
  }

  /**
   * Upload di un file da stream
   */
  async uploadFromStream(
    stream: Readable,
    options: UploadOptions = {}
  ): Promise<{ path: string; url: string }> {
    const client = await this.connect();
    
    try {
      const remotePath = this.generateFilePath(options);
      const directory = remotePath.substring(0, remotePath.lastIndexOf("/"));
      
      // Crea la struttura di cartelle
      await this.ensureDirectory(client, directory);
      
      // Upload del file
      await client.uploadFrom(stream, remotePath);
      
      console.log(`✅ File uploaded to FTP: ${remotePath}`);
      
      const publicUrl = `ftp://${this.config.host}/${remotePath}`;
      
      return {
        path: remotePath,
        url: publicUrl,
      };
    } catch (error) {
      console.error("FTP upload error:", error);
      throw new Error("Errore durante l'upload del file su FTP");
    } finally {
      client.close();
    }
  }

  /**
   * Genera un URL temporaneo per l'upload diretto
   * Nota: FTP non supporta upload diretti come S3, quindi
   * questo metodo restituisce informazioni per gestire l'upload via server
   */
  async getUploadUrl(options: UploadOptions = {}): Promise<{
    uploadUrl: string;
    filePath: string;
  }> {
    const filePath = this.generateFilePath(options);
    
    // Per FTP, l'upload deve passare attraverso il server
    // Restituiamo un URL che il client può usare per uploadare via API
    return {
      uploadUrl: `/api/ftp/upload`, // Endpoint che gestirà l'upload
      filePath,
    };
  }

  /**
   * Elimina un file dal server FTP
   */
  async deleteFile(remotePath: string): Promise<void> {
    const client = await this.connect();
    
    try {
      await client.remove(remotePath);
      console.log(`🗑️ File deleted from FTP: ${remotePath}`);
    } catch (error) {
      console.error("FTP delete error:", error);
      throw new Error("Errore durante l'eliminazione del file da FTP");
    } finally {
      client.close();
    }
  }

  /**
   * Lista i file in una directory
   */
  async listFiles(remotePath: string = "assets/digiteka"): Promise<string[]> {
    const client = await this.connect();
    
    try {
      const files = await client.list(remotePath);
      return files.map(file => file.name);
    } catch (error) {
      console.error("FTP list error:", error);
      throw new Error("Errore durante la lettura della directory FTP");
    } finally {
      client.close();
    }
  }

  /**
   * Scarica un file dal server FTP e lo invia tramite response
   */
  async downloadFileToResponse(filePath: string, res: any): Promise<void> {
    const client = await this.connect();
    
    try {
      console.log(`📥 Downloading file from FTP: ${filePath}`);
      
      // Download del file direttamente nella response
      await client.downloadTo(res, filePath);
      
      console.log(`✅ File downloaded successfully: ${filePath}`);
    } catch (error) {
      console.error(`❌ Error downloading file ${filePath}:`, error);
      throw new Error("Errore durante il download del file");
    } finally {
      client.close();
    }
  }

  /**
   * Verifica se un file esiste sul server FTP
   */
  async fileExists(filePath: string): Promise<boolean> {
    const client = await this.connect();
    
    try {
      // Prova a ottenere la dimensione del file - se funziona, il file esiste
      const size = await client.size(filePath);
      console.log(`📏 File ${filePath} exists, size: ${size} bytes`);
      return size > 0 || size === 0; // Anche i file vuoti esistono
    } catch (error) {
      console.log(`⚠️ File ${filePath} does not exist on FTP`);
      return false;
    } finally {
      client.close();
    }
  }

  /**
   * Verifica la connessione FTP
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = await this.connect();
      client.close();
      return true;
    } catch (error) {
      console.error("FTP connection test failed:", error);
      return false;
    }
  }
}
