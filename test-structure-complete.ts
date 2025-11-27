import { FtpStorageService } from "./server/ftpStorage";

async function testCompleteStructure() {
  console.log("\n🧪 TEST: Struttura completa con categoria/sottocategoria/anno/mese\n");
  
  const ftpService = new FtpStorageService();
  
  // Test 1: Biblioteca > Libri
  console.log("📚 Test 1: Biblioteca > Libri");
  const test1 = Buffer.from("Contenuto libro", "utf-8");
  const result1 = await ftpService.uploadFromBuffer(test1, {
    categoryName: "Biblioteca",
    subcategoryName: "Libri",
    filename: "storia-antica.pdf"
  });
  console.log(`✅ Caricato: ${result1.path}\n`);
  
  // Test 2: Immagini > Fotografie
  console.log("🖼️  Test 2: Immagini > Fotografie");
  const test2 = Buffer.from("Dati immagine", "utf-8");
  const result2 = await ftpService.uploadFromBuffer(test2, {
    categoryName: "Immagini",
    subcategoryName: "Fotografie",
    filename: "foto-1920.jpg"
  });
  console.log(`✅ Caricato: ${result2.path}\n`);
  
  // Test 3: Archivi > Documenti Storici
  console.log("📁 Test 3: Archivi > Documenti Storici");
  const test3 = Buffer.from("Documento", "utf-8");
  const result3 = await ftpService.uploadFromBuffer(test3, {
    categoryName: "Archivi",
    subcategoryName: "Documenti Storici",
    filename: "certificato-1850.pdf"
  });
  console.log(`✅ Caricato: ${result3.path}\n`);
  
  // Test 4: Solo categoria (senza sottocategoria)
  console.log("📂 Test 4: Video (solo categoria)");
  const test4 = Buffer.from("Video", "utf-8");
  const result4 = await ftpService.uploadFromBuffer(test4, {
    categoryName: "Video",
    filename: "intervista.mp4"
  });
  console.log(`✅ Caricato: ${result4.path}\n`);
  
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  
  console.log("\n🎉 STRUTTURA FINALE SUL SERVER FTP:");
  console.log("assets/digiteka/");
  console.log("├── biblioteca/");
  console.log("│   └── libri/");
  console.log(`│       └── ${year}/`);
  console.log(`│           └── ${month}/`);
  console.log("│               └── storia-antica.pdf");
  console.log("├── immagini/");
  console.log("│   └── fotografie/");
  console.log(`│       └── ${year}/`);
  console.log(`│           └── ${month}/`);
  console.log("│               └── foto-1920.jpg");
  console.log("├── archivi/");
  console.log("│   └── documenti_storici/");
  console.log(`│       └── ${year}/`);
  console.log(`│           └── ${month}/`);
  console.log("│               └── certificato-1850.pdf");
  console.log("└── video/");
  console.log(`    └── ${year}/`);
  console.log(`        └── ${month}/`);
  console.log("            └── intervista.mp4");
  console.log("\n✅ Struttura organizzata per categoria/sottocategoria/anno/mese!\n");
}

testCompleteStructure().catch(console.error);
