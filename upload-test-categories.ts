import { FtpStorageService } from "./server/ftpStorage";

async function uploadWithCategories() {
  console.log("🧪 Testing FTP upload with category subfolders\n");
  
  const ftpService = new FtpStorageService();
  
  
  const testCategories = [
    { name: "Biblioteca", file: "libro-test.txt" },
    { name: "Immagini", file: "foto-test.jpg" },
    { name: "Archivi", file: "documento-test.pdf" },
  ];
  
  try {
    for (const test of testCategories) {
      console.log(`\n📤 Uploading to category: ${test.name}`);
      
      const testContent = Buffer.from(`Test file for category ${test.name}\nUploaded at ${new Date().toISOString()}\n`);
      
      const result = await ftpService.uploadFromBuffer(testContent, {
        categoryName: test.name,
        filename: test.file,
      });
      
      console.log(`✅ Uploaded: ${result.path}`);
    }
    
    console.log("\n\n🎉 SUCCESS! All files uploaded with category subfolders:");
    console.log("   assets/digiteka/biblioteca/libro-test.txt");
    console.log("   assets/digiteka/immagini/foto-test.jpg");
    console.log("   assets/digiteka/archivi/documento-test.pdf");
    
  } catch (error) {
    console.error("\n❌ FAILED:", error);
    process.exit(1);
  }
}

uploadWithCategories();
