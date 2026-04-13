# NoteHub Flutter Client (Android + Web)

This folder contains a reference Flutter client that talks to the **same backend APIs + database** as the web app in this repo, so data stays synchronized across platforms.

## Backend summary (from this repo)

**Database:** PostgreSQL (Drizzle ORM)

**Auth:** Session cookie (`notehub.sid`) via `express-session` + `passport`

**Core REST endpoints:**

- Auth
  - `POST /api/register`
  - `POST /api/login`
  - `POST /api/logout`
  - `GET /api/user` (current session)
- Notes
  - `GET /api/notes?search=...`
  - `GET /api/notes/:id`
  - `POST /api/notes` (multipart/form-data; requires `file`)
  - `POST /api/notes/:id/download` (records download)

## How to use this

This repo doesn’t include the Flutter SDK, so this folder is meant as **drop-in `lib/` code + dependencies**.

1. Install Flutter SDK
2. Create a Flutter project:
   - `flutter create notehub_flutter`
3. Copy:
   - Replace `notehub_flutter/lib` with this folder’s `flutter_app/lib`
   - Merge dependencies from `flutter_app/pubspec.yaml` into your project’s `pubspec.yaml`
4. Run the backend (this repo):
   - `npm.cmd run dev` (serves `http://localhost:5000` by default)
5. Run Flutter:
   - Android emulator: `flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5000`
   - Chrome (Flutter web): `flutter run -d chrome --dart-define=API_BASE_URL=http://localhost:5000`

## Auth + cookies (important)

- The backend uses a **session cookie** (`notehub.sid`).
- Flutter **web** relies on browser cookies (Dio is configured with `withCredentials = true`).
- Flutter **mobile** uses an in-memory cookie store in this sample. For “stay signed in”, persist it (secure storage recommended) or migrate mobile auth to tokens.

## Production gotchas (CORS + Origin guard)

- If you serve Flutter Web from a different origin than the API, you’ll need **CORS with credentials**.
- This backend can enforce an `Origin` guard via `ALLOWED_ORIGINS` (CSRF mitigation). Mobile apps usually send no `Origin` header, so if you enable it you may need to adjust the policy or switch mobile to token auth.

For local development, this repo now includes a minimal CORS middleware for `/api` (credentials-enabled) so Flutter Web can call the backend from its dev server.

## Sync strategy (REST vs real-time)

With a shared backend DB, changes from either app are immediately visible to the other **once they refetch**.

- REST-only (simple): refresh on screen open, pull-to-refresh, and after mutations.
- Real-time (optional): add WebSocket/SSE events like `note_created` and refresh/patch local state on receipt.
