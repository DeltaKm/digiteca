import { FtpStorageService } from "./ftpStorage";

/**
 * Script di test per verificare la connessione FTP
 * Uso: tsx server/testFtp.ts
 */
async function testFtpConnection() {
  console.log("🧪 Testing FTP connection...");
  
  const ftpService = new FtpStorageService();
  
  try {
    // Test 1: Verifica connessione
    console.log("\n1️⃣ Testing connection...");
    const isConnected = await ftpService.testConnection();
    
    if (isConnected) {
      console.log("✅ FTP connection successful!");
    } else {
      console.log("❌ FTP connection failed!");
      return;
    }
    
    // Test 2: Upload di un file di test
    console.log("\n2️⃣ Testing file upload...");
    const testContent = Buffer.from("This is a test file from Digiteka\n" + new Date().toISOString());
    
    const uploadResult = await ftpService.uploadFromBuffer(testContent, {
      categoryName: "test",
      filename: `test-${Date.now()}.txt`,
    });
    
    console.log("✅ File uploaded successfully!");
    console.log("   Path:", uploadResult.path);
    console.log("   URL:", uploadResult.url);
    
    // Test 3: Lista file nella directory
    console.log("\n3️⃣ Listing files in assets/digiteka...");
    try {
      const files = await ftpService.listFiles("assets/digiteka");
      console.log(`✅ Found ${files.length} items:`);
      files.forEach(file => console.log(`   - ${file}`));
    } catch (error) {
      console.log("⚠️ Could not list files (directory might not exist yet)");
    }
    
    console.log("\n🎉 All tests passed!");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the test
testFtpConnection()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
