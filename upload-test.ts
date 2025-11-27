import { FtpStorageService } from "./server/ftpStorage";

async function uploadTestFile() {
  console.log("🧪 Testing FTP upload to assets/digiteka/");
  
  const ftpService = new FtpStorageService();
  
  try {
    // Crea un file di test
    const testContent = Buffer.from(`TEST FILE - Uploaded at ${new Date().toISOString()}\n\nThis is a test file to verify FTP upload functionality.\n`);
    
    console.log("📤 Uploading test file...");
    
    const result = await ftpService.uploadFromBuffer(testContent, {
      filename: `test-${Date.now()}.txt`,
    });
    
    console.log("\n✅ SUCCESS!");
    console.log("📁 File path:", result.path);
    console.log("🔗 File URL:", result.url);
    console.log("\nThe file has been uploaded to the FTP server in the 'assets/digiteka/' folder.");
    
  } catch (error) {
    console.error("\n❌ FAILED:", error);
    process.exit(1);
  }
}

uploadTestFile();
