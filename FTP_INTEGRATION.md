# Integrazione FTP Storage per Digiteka

## Panoramica

Il sistema è stato modificato per salvare i file caricati su un server FTP esterno invece che su Google Cloud Storage. I file vengono organizzati in una struttura di directory basata sulle categorie.

## Struttura dei File

I file vengono salvati sul server FTP con la seguente struttura organizzata per categoria:

```
assets/
  └── digiteka/
      ├── biblioteca/
      │   └── file1.pdf
      ├── immagini/
      │   └── foto1.jpg
      ├── archivi/
      │   └── documento1.pdf
      └── general/
          └── file-senza-categoria.txt
```

Ogni categoria ha la sua sottocartella. I file senza categoria vanno in `general/`.

### Esempio:
- Categoria "Biblioteca" → `assets/digiteka/biblioteca/documento.pdf`
- Categoria "Immagini" → `assets/digiteka/immagini/foto.jpg`
- Senza categoria → `assets/digiteka/general/file.txt`

## Configurazione

### Variabili d'Ambiente

Aggiungi queste variabili al file `.env`:

```env
# FTP Storage Configuration
FTP_HOST="80.211.227.121"
FTP_USER="digiteca"
FTP_PASSWORD="ULJ5v&tU#RWNnjG"
```

## File Modificati

### Backend

1. **`server/ftpStorage.ts`** (NUOVO)
   - Classe `FtpStorageService` per gestire operazioni FTP
   - Metodi:
     - `uploadFromBuffer()` - Upload da buffer
     - `uploadFromStream()` - Upload da stream
     - `deleteFile()` - Elimina file
     - `listFiles()` - Lista file in una directory
     - `testConnection()` - Testa la connessione

2. **`server/routes.ts`** (MODIFICATO)
   - `/api/objects/upload` - Usa FTP invece di Google Cloud Storage
   - `/api/ftp/upload` - Nuovo endpoint per upload diretto FTP
   - `/api/objects/set-acl` - Semplificato (FTP non ha ACL)
   - `/api/admin/documents/:id/file` - Usa percorsi FTP

3. **`server/testFtp.ts`** (NUOVO)
   - Script di test per verificare la connessione FTP
   - Uso: `NODE_ENV=test npx tsx server/testFtp.ts`

### Frontend

4. **`client/src/components/admin/upload-modal.tsx`** (MODIFICATO)
   - `fileUploadMutation` - Modificato per usare endpoint FTP
   - Upload immagini per manifest - Modificato per FTP
   - I file vengono salvati direttamente in `assets/digiteka/`

## API Endpoints

### POST `/api/ftp/upload`

Upload diretto di un file sul server FTP.

**Query Parameters:**
- `category` - Nome della categoria (opzionale)
- `filename` - Nome del file (opzionale)

**Request:**
- Body: File binario (raw file data)
- Headers: 
  - `Content-Type`: tipo MIME del file
  - `X-CSRF-Token`: token CSRF

**Response:**
```json
{
  "success": true,
  "path": "assets/digiteka/file.jpg",
  "url": "ftp://80.211.227.121/assets/digiteka/file.jpg",
  "objectPath": "assets/digiteka/file.jpg"
}
```

### POST `/api/objects/upload`

Endpoint di compatibilità (restituisce URL per upload FTP).

**Response:**
```json
{
  "uploadURL": "/api/ftp/upload",
  "objectPath": "assets/digiteka/file-uuid"
}
```

## Test

Esegui il test di connessione FTP:

```bash
NODE_ENV=test npx tsx server/testFtp.ts
```

Il test verifica:
1. ✅ Connessione al server FTP
2. ✅ Upload di un file di test
3. ✅ Lettura della directory

## Vantaggi

- **Indipendenza**: Non dipende più da Google Cloud Storage o Replit
- **Semplicità**: Gestione diretta dei file tramite FTP standard
- **Organizzazione**: File organizzati per categoria in sottocartelle
- **Costi**: Usa il tuo server FTP senza costi aggiuntivi

## Note

- I nomi delle categorie vengono normalizzati (lowercase, underscore al posto degli spazi)
- Ogni categoria ha la sua sottocartella in `assets/digiteka/{categoria}/`
- I file senza categoria vengono salvati in `assets/digiteka/general/`
- Le cartelle vengono create automaticamente se non esistono
- I file vengono creati con permessi standard del server FTP
- La connessione FTP è **non sicura** (non FTPS). Considera l'upgrade a FTPS in produzione
- I file caricati sono immediatamente accessibili via FTP

## Troubleshooting

### Errore "Can't open that file"
- Verifica che le directory `assets/digiteka` esistano sul server FTP
- Il sistema crea automaticamente le sottocartelle per categoria

### Errore di connessione
- Verifica le credenziali FTP nel file `.env`
- Verifica che il server FTP sia raggiungibile
- Esegui `NODE_ENV=test npx tsx server/testFtp.ts` per diagnostica

### Upload fallito
- Verifica i permessi di scrittura sul server FTP
- Verifica lo spazio disponibile sul server FTP
- Controlla i log del server per dettagli
