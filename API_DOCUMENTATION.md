# Dokumentasi API Share Note SX

Dokumentasi resmi integrasi API untuk pembuatan dan pembacaan catatan terenkripsi pada Share Note SX.

---

## 1. Ikhtisar & Arsitektur Keamanan

Share Note SX menyediakan dua metode integrasi untuk membuat catatan terenkripsi:

| Metode | Endpoint | Lokasi Enkripsi | Server Memegang Kunci? | Penggunaan Ideal |
|---|---|---|---|---|
| **Server-Side Encryption** | `POST /api/shares/plain` | Server (Backend) | Kunci dibuat di server lalu dikembalikan ke client; kunci tidak disimpan di database. | Integrasi mudah dari backend/cron/CLI tanpa perlu modul kriptografi client. |
| **Zero-Knowledge (Client-Side)** | `POST /api/shares` | Client (Browser/App) | Server **tidak pernah** menerima kunci maupun plaintext. | Privasi absolut zero-knowledge (end-to-end encrypted). |

### Format URL Catatan
Kedua metode di atas menghasilkan URL catatan publik dengan format URL fragment `#`:
```text
https://domain.com/s/<shareId>#<decryptionKey>
```
> **Catatan Penting**: Karakter setelah `#` (*URL hash fragment*) **tidak pernah dikirim oleh browser ke server** dalam request HTTP. Oleh karena itu, server hanya melayani ciphertext, dan dekripsi dilakukan secara lokal di perangkat pembaca.

---

## 2. Autentikasi API

Semua request pembuatan catatan (`POST /api/shares` dan `POST /api/shares/plain`) wajib menyertakan **Secret Key** yang didapat dari Dashboard Administrator (`/dashboard`).

Sertakan Secret Key melalui salah satu header berikut:
- **Header `x-api-key` (Direkomendasikan)**:
  ```http
  x-api-key: snx_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
  ```
- **Header `Authorization`**:
  ```http
  Authorization: Bearer snx_sec_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
  ```

---

## 3. Spesifikasi Endpoint

---

### A. `POST /api/shares/plain`
Endpoint untuk mengirim plain text langsung. Proses enkripsi **AES-256-GCM** dijalankan di server. Kunci dekripsi dan URL lengkap langsung dikembalikan dalam response.

#### Headers
```http
Content-Type: application/json
x-api-key: <SECRET_KEY>
```

#### Request Body
Mendukung properti `text`, `content`, `plaintext`, atau `markdown`:

```json
{
  "text": "# Judul Catatan\n\nIsi catatan yang akan dienkripsi.",
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

| Field | Tipe | Wajib? | Deskripsi |
|---|---|---|---|
| `text` / `content` / `plaintext` / `markdown` | `string` | **Ya** | Teks catatan yang akan dienkripsi. |
| `expiresAt` | `string` (ISO 8601) | Tidak | Waktu kadaluarsa catatan (UTC). Jika tidak diisi, catatan berlaku permanen (`null`). |

#### Response `201 Created`
```json
{
  "shareId": "IxWlSP5BqSZPUIa3uL7qzatY",
  "url": "https://domain.com/s/IxWlSP5BqSZPUIa3uL7qzatY#A7OMzAlIw28mYRKFTvYDpaZmHW0cCpOwDZXuSSh0aNY",
  "key": "A7OMzAlIw28mYRKFTvYDpaZmHW0cCpOwDZXuSSh0aNY",
  "expiresAt": null
}
```

---

### B. `POST /api/shares`
Endpoint untuk flow **Zero-Knowledge**. Catatan dienkripsi di sisi klien menggunakan algoritma **AES-256-GCM**. Klien hanya mengirimkan `ciphertext` dan `iv` (kunci dekripsi tetap di klien).

#### Headers
```http
Content-Type: application/json
x-api-key: <SECRET_KEY>
```

#### Request Body
```json
{
  "ciphertext": "EOE1.eyJ2IjoxLCJhbGciOiJBMjU2R0NNIiwia2RmIj...",
  "iv": "3d966387-f335-47d1-906c-c6032ca32b5d",
  "expiresAt": null
}
```

| Field | Tipe | Wajib? | Deskripsi |
|---|---|---|---|
| `ciphertext` | `string` (Base64URL) | **Ya** | Data terenkripsi dalam format Base64URL. |
| `iv` | `string` (Base64URL) | **Ya** | Initialization Vector (12 bytes) dalam format Base64URL. |
| `expiresAt` | `string` (ISO 8601) | Tidak | Waktu kadaluarsa catatan. |

#### Response `201 Created`
```json
{
  "shareId": "q70aCIpdzuCvzyRxWt31NMVZ",
  "expiresAt": null
}
```
*Klien kemudian membentuk URL:*
```text
https://domain.com/s/{shareId}#{rawKeyBase64Url}
```

---

### C. `GET /api/shares/:shareId`
Endpoint publik untuk mengambil data terenkripsi berdasarkan `shareId`. Digunakan oleh browser/pembaca sebelum melakukan proses dekripsi lokal.

#### Headers
Tidak memerlukan `x-api-key` (dapat diakses secara publik oleh pembaca catatan).

#### Response `200 OK`
```json
{
  "shareId": "q70aCIpdzuCvzyRxWt31NMVZ",
  "ciphertext": "EOE1.eyJ2IjoxLCJhbGciOiJBMjU2R0NNIiwia2RmIj...",
  "iv": "3d966387-f335-47d1-906c-c6032ca32b5d",
  "expiresAt": null
}
```

#### Status Code Penting
- `404 Not Found`: Catatan dengan `shareId` tersebut tidak ditemukan.
- `410 Gone`: Catatan telah melewati batas waktu `expiresAt`.

---

### D. `PUT` / `PATCH` `/api/shares/plain/:shareId`
Memperbarui isi catatan yang sudah ada menggunakan teks biasa (server-side re-encryption).

#### Headers
```http
Content-Type: application/json
x-api-key: <SECRET_KEY>
```

#### Request Body
```json
{
  "text": "# Judul Telah Diperbarui\n\nIsi catatan yang baru.",
  "key": "A7OMzAlIw28mYRKFTvYDpaZmHW0cCpOwDZXuSSh0aNY",
  "expiresAt": null
}
```

| Field | Tipe | Wajib? | Deskripsi |
|---|---|---|---|
| `text` / `content` / `markdown` | `string` | **Ya** | Teks baru yang akan dienkripsi ulang. |
| `key` | `string` (Base64URL) | Tidak | Kunci dekripsi lama (dari URL `#fragment`). **Jika disertakan, URL catatan lama tetap valid dan tidak berubah**. Jika diabaikan, server akan membuat kunci baru dan mengembalikan URL baru. |
| `expiresAt` | `string` (ISO 8601) | Tidak | Waktu kadaluarsa baru (opsional). |

#### Response `200 OK`
```json
{
  "shareId": "IxWlSP5BqSZPUIa3uL7qzatY",
  "updated": true,
  "url": "https://domain.com/s/IxWlSP5BqSZPUIa3uL7qzatY#A7OMzAlIw28mYRKFTvYDpaZmHW0cCpOwDZXuSSh0aNY",
  "key": "A7OMzAlIw28mYRKFTvYDpaZmHW0cCpOwDZXuSSh0aNY",
  "expiresAt": null
}
```

---

### E. `PUT` / `PATCH` `/api/shares/:shareId`
Memperbarui catatan yang sudah ada untuk alur **Zero-Knowledge** (klien mengirimkan `ciphertext` dan `iv` baru) atau memperbarui batas kadaluarsa.

#### Headers
```http
Content-Type: application/json
x-api-key: <SECRET_KEY>
```

#### Request Body
```json
{
  "ciphertext": "new_base64url_ciphertext...",
  "iv": "new_base64url_iv...",
  "expiresAt": null
}
```

#### Response `200 OK`
```json
{
  "shareId": "q70aCIpdzuCvzyRxWt31NMVZ",
  "updated": true,
  "expiresAt": null
}
```

---

## 4. Status Code & Penanganan Error

| Status Code | Error Message | Penyebab & Solusi |
|---|---|---|
| `400 Bad Request` | `Invalid share payload` / `Content must not be empty` | Format payload tidak sesuai atau teks kosong. |
| `401 Unauthorized` | `Missing API secret key in 'x-api-key' or 'Authorization: Bearer' header` | Header autentikasi tidak disertakan pada request `POST`. |
| `401 Unauthorized` | `Invalid API secret key` | Secret key salah atau tidak ditemukan di database. |
| `403 Forbidden` | `API secret key has been revoked` | Secret key telah dicabut oleh admin melalui Dashboard. Buat key baru di `/dashboard`. |
| `403 Forbidden` | `API secret key has expired` | Masa berlaku Secret Key telah habis. |
| `404 Not Found` | `Note not found` | Catatan tidak ditemukan. |
| `410 Gone` | `Note has expired` | Masa berlaku catatan telah habis. |

---

## 5. Contoh Implementasi di Client

### A. cURL

#### 1. Plain Text (Server-Side Encryption)
```bash
curl -X POST http://localhost:3000/api/shares/plain \
  -H "Content-Type: application/json" \
  -H "x-api-key: snx_sec_YOUR_SECRET_KEY" \
  -d '{
    "text": "# Catatan Baru\n\nIni teks rahasia dari terminal."
  }'
```

#### 2. Update Catatan (Server-Side Plain Text)
```bash
curl -X PUT http://localhost:3000/api/shares/plain/IxWlSP5BqSZPUIa3uL7qzatY \
  -H "Content-Type: application/json" \
  -H "x-api-key: snx_sec_YOUR_SECRET_KEY" \
  -d '{
    "text": "# Catatan Telah Diperbarui\n\nIsi konten versi 2.",
    "key": "A7OMzAlIw28mYRKFTvYDpaZmHW0cCpOwDZXuSSh0aNY"
  }'
```

#### 3. Ambil Ciphertext
```bash
curl http://localhost:3000/api/shares/q70aCIpdzuCvzyRxWt31NMVZ
```

---

### B. JavaScript / TypeScript (Fetch API)

#### Implementasi Server-Side Encryption (`/api/shares/plain`)
```typescript
interface SharePlainResponse {
  shareId: string;
  url: string;
  key: string;
  expiresAt: string | null;
}

async function createPlainNote(markdown: string, apiKey: string): Promise<string> {
  const response = await fetch("https://your-domain.com/api/shares/plain", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey
    },
    body: JSON.stringify({
      text: markdown
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `HTTP error ${response.status}`);
  }

  const data: SharePlainResponse = await response.json();
  return data.url; // URL siap dibagikan ke pembaca
}

// Contoh pemakaian:
// const url = await createPlainNote("# Catatan Penting", "snx_sec_xxxx...");
// console.log("Share link:", url);
```

---

### C. Client-Side Encryption (Zero-Knowledge Flow)
Gunakan fungsi bawaan **Web Crypto API** (didukung di Browser modern dan Node.js 18+):

```typescript
const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function encryptNoteClientSide(markdown: string) {
  // 1. Generate random AES-256 key
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // 2. Generate 12-byte random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 3. Enkripsi teks
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(markdown)
  );

  // 4. Export raw key ke Base64URL
  const rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", key));

  return {
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertextBuffer)),
    iv: bytesToBase64Url(iv),
    key: bytesToBase64Url(rawKey)
  };
}

async function publishZeroKnowledgeNote(markdown: string, apiKey: string, baseUrl: string) {
  // Enkripsi di perangkat lokal
  const encrypted = await encryptNoteClientSide(markdown);

  // Kirim HANYA ciphertext dan iv ke server
  const response = await fetch(`${baseUrl}/api/shares`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey
    },
    body: JSON.stringify({
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv
    })
  });

  if (!response.ok) {
    throw new Error("Gagal membuat share");
  }

  const data = await response.json();

  // Kunci dekripsi disematkan pada fragment hash (#)
  const shareUrl = `${baseUrl}/s/${data.shareId}#${encrypted.key}`;
  return shareUrl;
}
```

---

### D. Python (Requests)

```python
import requests

API_URL = "http://localhost:3000/api/shares/plain"
API_KEY = "snx_sec_YOUR_SECRET_KEY"

payload = {
    "text": "# Catatan dari Python\n\nDikirim via script automation.",
    # "expiresAt": "2026-10-01T00:00:00Z" # opsional
}

headers = {
    "Content-Type": "application/json",
    "x-api-key": API_KEY
}

response = requests.post(API_URL, json=payload, headers=headers)

if response.status_code == 201:
    data = response.json()
    print("Berhasil!")
    print("Share ID :", data["shareId"])
    print("Share URL:", data["url"])
else:
    print(f"Error {response.status_code}:", response.json())
```
