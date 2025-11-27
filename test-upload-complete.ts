import { FtpStorageService } from "./server/ftpStorage";

async function testCompleteUpload() {
  console.log("\n🧪 TEST: Upload completo con sottocartelle categoria\n");
  
  const ftpService = new FtpStorageService();
  
  // Test 1: Upload in categoria Biblioteca
  console.log("📚 Test 1: Caricamento in Biblioteca");
  const testFile1 = Buffer.from("Contenuto del libro di storia", "utf-8");
  const result1 = await ftpService.uploadFromBuffer(testFile1, {
    categoryName: "Biblioteca",
    filename: "storia-medievale.pdf"
  });
  console.log(`✅ Caricato: ${result1.path}\n`);
  
  // Test 2: Upload in categoria Immagini
  console.log("🖼️  Test 2: Caricamento in Immagini");
  const testFile2 = Buffer.from("Dati immagine JPG...", "utf-8");
  const result2 = await ftpService.uploadFromBuffer(testFile2, {
    categoryName: "Immagini",
    filename: "foto-antica-1920.jpg"
  });
  console.log(`✅ Caricato: ${result2.path}\n`);
  
  // Test 3: Upload in categoria Archivi
  console.log("📁 Test 3: Caricamento in Archivi");
  const testFile3 = Buffer.from("Documento d'archivio", "utf-8");
  const result3 = await ftpService.uploadFromBuffer(testFile3, {
    categoryName: "Archivi",
    filename: "documento-storico-1850.pdf"
  });
  console.log(`✅ Caricato: ${result3.path}\n`);
  
  // Test 4: Upload in categoria Video
  console.log("🎥 Test 4: Caricamento in Video");
  const testFile4 = Buffer.from("Dati video...", "utf-8");
  const result4 = await ftpService.uploadFromBuffer(testFile4, {
    categoryName: "Video",
    filename: "intervista-2024.mp4"
  });
  console.log(`✅ Caricato: ${result4.path}\n`);
  
  // Test 5: Upload in categoria Audio
  console.log("🎵 Test 5: Caricamento in Audio");
  const testFile5 = Buffer.from("Dati audio...", "utf-8");
  const result5 = await ftpService.uploadFromBuffer(testFile5, {
    categoryName: "Audio",
    filename: "registrazione-orale.mp3"
  });
  console.log(`✅ Caricato: ${result5.path}\n`);
  
  console.log("\n🎉 STRUTTURA FINALE SUL SERVER FTP:");
  console.log("assets/digiteka/");
  console.log("├── biblioteca/");
  console.log("│   └── storia-medievale.pdf");
  console.log("├── immagini/");
  console.log("│   └── foto-antica-1920.jpg");
  console.log("├── archivi/");
  console.log("│   └── documento-storico-1850.pdf");
  console.log("├── video/");
  console.log("│   └── intervista-2024.mp4");
  console.log("└── audio/");
  console.log("    └── registrazione-orale.mp3");
  console.log("\n✅ Tutti i file sono stati caricati con successo!\n");
}

testCompleteUpload().catch(console.error);
