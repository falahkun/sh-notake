# Share Note SX

A minimal Next.js implementation of zero-knowledge public note sharing.

## Core idea

The note is encrypted **before it leaves the browser** using AES-256-GCM.

The generated URL has this shape:

```text
https://your-app.example/s/<share-id>#<decryption-key>
```

The important property is the `#fragment`.

Browsers do not include URL fragments in HTTP requests. Therefore the server receives the share ID, but never receives the decryption key.

The server stores only:

- share ID
- ciphertext
- IV
- optional expiry

It never stores the plaintext note or AES key.

### Read flow

```text
Full URL
  |
  +-- /s/<share-id> ---> server
  |                         |
  |                         +--> ciphertext + IV
  |
  +-- #<key> ------------> browser only
                              |
                    AES-GCM decrypt
                              |
                           Markdown
```

A normal crawler that only fetches the URL from the server receives ciphertext. It cannot reconstruct the plaintext without executing the client-side decryption with the key.

This is not an absolute anti-scraping guarantee. A browser automation agent that is given the full URL and executes the page like a real browser can potentially read the decrypted content.

## Stack

- Next.js
- React
- TanStack Query
- Zustand
- Zod
- Drizzle ORM
- PostgreSQL
- pnpm
- Docker
- react-markdown + remark-gfm
- Web Crypto API / AES-256-GCM
- Vitest

## API

> 📖 **Dokumentasi Lengkap API & Contoh Client**: Lihat [API_DOCUMENTATION.md](file:///Users/ubuntyou/Developments/Work/halflysis/share-note-sx/API_DOCUMENTATION.md) untuk panduan integrasi lengkap (cURL, TypeScript, Python) serta spesifikasi endpoint `/api/shares` dan `/api/shares/plain`.

### POST `/api/shares`

Creates a public encrypted share.

Request:

```json
{
  "ciphertext": "base64url...",
  "iv": "base64url..."
}
```

Response:

```json
{
  "shareId": "random-id",
  "expiresAt": null
}
```

The client then appends the locally-held key to the URL fragment.

### GET `/api/shares/:shareId`

Returns encrypted data.

Success:

```json
{
  "shareId": "random-id",
  "ciphertext": "...",
  "iv": "...",
  "expiresAt": null
}
```

Not found:

```http
404
```

Expired:

```http
410
```

## Positive cases

1. Valid share ID + valid key -> Markdown renders.
2. Markdown supports GFM tables, lists, links, code blocks, etc.
3. No key is sent to the API.
4. The server never sees plaintext.

## Negative cases

1. Unknown share ID -> `404` and "Note not found".
2. Expired share -> `410` and "Link expired".
3. Missing URL fragment -> "Unable to open note".
4. Wrong key -> AES-GCM authentication fails and the note is not rendered.
5. Malformed create request -> `400`.
6. Server/database failure -> `500`.

## Run

```bash
pnpm install
cp .env.example .env

docker compose up -d

pnpm db:generate
pnpm db:migrate

pnpm dev
```

Open:

```text
http://localhost:3000
```

## Test

```bash
pnpm test
```

## Security notes

- HTTPS is required in production.
- Do not log the complete share URL. The fragment itself is not sent to the server, but client/browser history can contain it.
- Do not add analytics that transmit `location.hash`.
- Do not put the decryption key in query parameters.
- Do not add a server endpoint that accepts the key and decrypts the note.
- `robots.txt`/`noindex` can reduce indexing, but encryption is the actual confidentiality mechanism.
- Add rate limiting/WAF before production deployment.
- Consider Content Security Policy and strict dependency review before production.
