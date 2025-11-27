import { FtpStorageService } from "./server/ftpStorage";

async function quickTest() {
  console.log("\n🧪 TEST RAPIDO: Upload documento Kere > Pratiche\n");
  
  const ftpService = new FtpStorageService();
  
  // Test documento in Kere > Pratiche
  const testFile = Buffer.from("Contenuto del documento di test per Kere/Pratiche", "utf-8");
  
  const result = await ftpService.uploadFromBuffer(testFile, {
    categoryName: "Kere",
    subcategoryName: "Pratiche",
    filename: "documento-test-" + Date.now() + ".txt"
  });
  
  console.log(`✅ Caricato con successo!`);
  console.log(`📍 Path: ${result.path}`);
  console.log(`🔗 URL: ${result.url}`);
  
  // Mostra la struttura creata
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  
  console.log(`\n📂 Struttura creata sul server FTP:`);
  console.log(`   assets/digiteka/kere/pratiche/${year}/${month}/documento-test-*.txt`);
  console.log(`\n✅ Il file è stato caricato correttamente sul server FTP!\n`);
}

quickTest().catch(error => {
  console.error("\n❌ ERRORE:", error.message);
  process.exit(1);
});
