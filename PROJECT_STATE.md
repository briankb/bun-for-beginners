## File tree

```
.
├── about.html
├── db.ts
├── form.html
├── home.html
├── index.ts
├── layout.html
├── package.json
├── public/
│   └── style.css
├── README.md
├── routes.ts
├── routes.test.ts
├── seed.ts
├── server.test.ts
├── sessions.ts
├── templates.ts
├── templates.test.ts
├── tree-view-end-of-chapter-08.txt
├── tsconfig.json
├── users.ts
├── users.test.ts
├── wordcount.ts
└── wordcount.test.ts
```

*Not shown: `node_modules/`, `bun.lock`, `notes.db`, `notes.test.db`, and SQLite `-wal`/`-shm` sidecars (all gitignored).*

*Stale files still on disk: `wordcount.ts` / `wordcount.test.ts` (from Chapters 3–4, not used by the server); `form.html` and `home.html` (early-chapter scaffolding, no longer referenced — `home.html` was replaced by inline HTML in `routes.ts`, and the new-note form is now rendered by `renderForm` in `templates.ts`).*

## Module exports

### `db.ts`

- `db: Database` — SQLite database opened at `process.env.DB_PATH ?? "notes.db"` with `create: true`.
- Private: three top-level `db.run(...)` calls execute `CREATE TABLE IF NOT EXISTS notes (...)` (now with a `user_id` column), `CREATE TABLE IF NOT EXISTS users (...)`, and `CREATE TABLE IF NOT EXISTS sessions (...)` at module load.

### `index.ts`

- `server: Server` — `Bun.serve` instance on port 3000 wiring `/`, `/about`, `/notes/new`, `POST /notes`, `GET|POST /notes/:id/edit`, `POST /notes/:id/delete`, `/signup` (GET + POST), `/login` (GET + POST), `POST /logout`, `/success`, `/ok`, a `/*` static-file fallback into `./public`, a `fetch` 404 fallback, and an `error` handler that renders a 500 page via `page(...)`.
- Private: `import.meta.main` guard that logs the server URL when the module is the entrypoint.

### `routes.ts`

- `type Note` — DB row shape (`id`, `user_id`, `title`, `body`, `created_at`, `updated_at`).
- `validateNote(title, body)` — returns an array of error strings for empty title/body and title length > 200. Now exported (consumed by `routes.test.ts`).
- `home(req)` — Reads `currentUser(req)`. If logged out, renders a welcome page with sign-up / log-in links. If logged in, reads `q` and `page` from the query string, runs the search (`title LIKE ? OR body LIKE ?`) or plain-list query scoped to `user.id`, paginates with `LIMIT 10 OFFSET (page-1)*10`, renders each `<li>` with an Edit link (`/notes/:id/edit`) and an inline `POST /notes/:id/delete` button, and prepends a `<form class="search">` input plus a `<p class="flash">` banner when `?flash=...` is present (escaped). Falls back to `page = 1` for `?page=0`, negative, or non-numeric values. The empty-state message names the search term (escaped) when one was provided. The pager is appended via `renderPager(page, pageCount, q)`.
- `about(req)` — Returns the static About page, with nav rendered for the current user.
- `newNote(req)` — Redirects to `/login` (303) when logged out; otherwise returns the page wrapping `renderForm()` with empty values.
- `createNote(req): Promise<Response>` — Redirects to `/login` (303) when logged out. Parses the form body, calls `validateNote`, re-renders the form with errors at status 422 if invalid, otherwise inserts the note **stamped with `user.id`** and returns a 303 redirect to `/`.
- `editNote(req)` — Redirects to `/login` (303) when logged out. Looks up the note by `id` **and** `user_id` (so another user's note returns 404). Renders `renderForm` with the existing values and the `{ action: "/notes/:id/edit", heading: "Edit Note", submit: "Save Changes" }` options.
- `updateNote(req): Promise<Response>` — Same auth + ownership guard. Validates; on errors re-renders the edit form at 422 with the submitted values. On success runs `UPDATE notes SET title = ?, body = ?, updated_at = unixepoch() WHERE id = ? AND user_id = ?` and redirects to `/?flash=Note+saved.` (303).
- `deleteNote(req)` — Same auth + ownership guard. Deletes the row scoped by `user_id` and redirects to `/?flash=Note+deleted.` (303).
- `success(req)` — Returns the "Account created" confirmation page with a link to `/login`.
- Private: `PAGE_SIZE = 10`; `listNotes` (now takes `user_id, limit, offset`), `searchNotes` (adds `title LIKE ? OR body LIKE ?`), `countNotes`, `countSearchNotes`, `findNote`, `insertNote`, `updateNoteRow`, `deleteNoteRow` — prepared statements held at module scope. Both `listNotes` and `searchNotes` use `ORDER BY created_at DESC, id DESC` — the `id DESC` tiebreaker keeps pagination deterministic when multiple notes share a `created_at` second (without it, SQLite's tie order is undefined and pagination tests flake). All note queries that touch a specific row include `user_id = ?` to enforce ownership at the SQL layer; the search and count queries pass `%${q}%` for the LIKE pattern.

### `users.ts`

- `type User` — DB row shape (`id`, `email`, `password_hash`, `created_at`, `updated_at`).
- `validateSignup(email, password, passwordConfirm)` — returns an array of error strings for empty email, missing `@`, password shorter than 8 chars, and mismatched confirmation. Now exported (consumed by `users.test.ts`).
- `signup(req)` — Returns the page wrapping the sign-up form with empty values and no errors. Nav reflects `currentUser(req)`.
- `createUser(req): Promise<Response>` — Parses the form body, calls `validateSignup`, re-renders the form with errors at status 422 if invalid; otherwise hashes the password with `Bun.password.hash` (argon2id default), inserts the user, catches `UNIQUE` constraint errors to render an "Email already registered." 422, and returns a 303 redirect to `/success` on success. Non-UNIQUE errors are re-thrown to the server's `error` handler.
- `login(req)` — Returns the page wrapping the login form with empty values and no errors.
- `createLogin(req): Promise<Response>` — Parses the form body, returns a single "Email or password is incorrect." 422 for empty fields, unknown email, or wrong password (no leak about which case it was). On success, calls `createSession(user.id)` and sets a `session_id` cookie via `req.cookies.set(...)` with `httpOnly`, `sameSite: "lax"`, `path: "/"`, and `maxAge` matching the session lifetime, then returns a 303 redirect to `/`.
- `currentUser(req): User | null` — Reads `session_id` from `req.cookies`, looks up the session via `findSessionById` (which already filters on `expires_at > unixepoch()`), then looks up the user. Returns `null` if cookie/session/user is missing or expired. Now used by every handler in `routes.ts` and by `signup`/`login`/`about` to drive nav state.
- `logout(req): Response` — Reads `session_id` from `req.cookies`, calls `endSession` and `req.cookies.delete("session_id")` if present, and returns a 303 redirect to `/`. No-ops gracefully when no cookie is present.
- Private: `insertUser`, `findUserByEmail`, `findUserById` — prepared statements held at module scope; `renderSignupForm(values?, errors?)` — renders the sign-up `<form>` with escaped email round-trip (password fields never round-trip) and an optional `<ul class="errors">` list; `renderLoginForm(values?, errors?)` — same shape as `renderSignupForm` but with only an email field plus password (no confirm).

### `sessions.ts`

- `type Session` — DB row shape (`id: string`, `user_id: number`, `created_at: number`, `expires_at: number`).
- `createSession(userId: number): Session` — Generates a session ID with `randomUUIDv7()` from `"bun"`, sets `expires_at` to now + 30 days (`SESSION_DURATION_SECONDS`), inserts a row, and returns the new session.
- `findSessionById(id: string): Session | null` — Looks up a session by ID with `expires_at > unixepoch()` baked into the query, so an expired session is indistinguishable from a missing one.
- `endSession(id: string): void` — `DELETE FROM sessions WHERE id = ?`. Does not check the row existed.
- Private: `SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30` (30 days); `insertSession`, `findSession`, `deleteSession` — prepared statements/queries held at module scope.

### `seed.ts`

Standalone script (`bun run seed.ts`), not imported by the server. Holds a `quotes` array of 50 `{ title, body }` objects, asserts the length is exactly 50 (logs and `process.exit(1)` otherwise), wipes the `notes` table with `DELETE FROM notes`, then inserts every quote against `user_id = 1`. Useful for filling the database to exercise the search and pagination UI; assumes a user with `id = 1` already exists. Exports nothing.

### `templates.ts`

- `page(title, body, init?): Response` — Replaces `{{title}}` and `{{body}}` in the layout HTML and returns an HTML Response with `Content-Type: text/html; charset=utf-8`, merging any caller-supplied `init`. Does **not** replace `{{nav}}` — use `pageFor` for any page that should render nav. (Currently only the 500 error page in `index.ts` uses `page` directly.)
- `pageFor(user: User | null, title, body, init?): Response` — Same as `page` but also replaces `{{nav}}` with `renderNav(user)`. Every user-facing handler goes through this so nav reflects auth state.
- `renderNav(user: User | null): string` — Returns the logged-in nav (Home / About / New Note / inline `POST /logout` button) when given a user, and the logged-out nav (Home / About / Sign Up / Log In) when given `null`.
- `escapeHtml(s: string): string` — Replaces `& < > " '` with their HTML entity references.
- `renderForm(values?, errors?, options?): string` — Returns a `<form>` HTML block. `options` defaults to `{ action: "/notes", heading: "New Note", submit: "Save Note" }`; the edit handlers pass `{ action: "/notes/:id/edit", heading: "Edit Note", submit: "Save Changes" }`. Escapes prefilled values and prefixes a `<ul class="errors">` list when errors are present.
- `notFound(): Response` — Returns the styled 404 page via `pageFor(null, ...)` with status 404.
- `renderPager(page, pageCount, q): string` — Returns the `<nav class="pager">` block consumed by `home`. Returns `""` when `pageCount <= 1` so single-page lists render no pager. Builds prev/next URLs with `URLSearchParams` — `q` is included only when non-empty, `page` only when not 1, so page 1 links back to `/` (or `/?q=...`) rather than `/?page=1`. The current page becomes a `<span class="prev disabled">` / `<span class="next disabled">` instead of a link at the ends. All hrefs are escaped via `escapeHtml`.
- Private: top-level `await Bun.file("./layout.html").text()` reads the layout template once at module load; `NEW_NOTE_FORM` constant holds the default `FormOptions`.

## Database schema

```sql
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  )

CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
```

`notes.user_id` is required on every insert and threaded through every read/update/delete — there is no path that touches a note without scoping by the current user. There is **no** `FOREIGN KEY` declared on `notes.user_id` (only `sessions.user_id` has one); if the user row is removed there is nothing on the schema preventing orphaned notes.

`users.email` has a `UNIQUE` constraint — duplicate inserts throw a SQLite error containing `UNIQUE`, which `createUser` catches and turns into a 422 form error. `password_hash` stores the full self-describing `$argon2id$...` string from `Bun.password.hash` (algorithm, parameters, salt, hash). Passwords are never stored in plaintext and never round-trip into form values.

`sessions.id` is a `TEXT PRIMARY KEY` populated by `randomUUIDv7()` so the ID is unguessable — the cookie ships the ID directly and a sequential integer would be hijackable. There is no `updated_at` (a session is created and eventually deleted, never edited). `expires_at` is a Unix timestamp; `findSessionById` filters on `expires_at > unixepoch()`, so an expired session is treated the same as a missing one.

## Routes

| Method | Path | Handler | Auth | Response |
| --- | --- | --- | --- | --- |
| GET | `/` | `home` | optional | HTML — welcome page if logged out, the user's notes (with Edit/Delete + flash banner) if logged in |
| GET | `/about` | `about` | optional | HTML |
| GET | `/notes/new` | `newNote` | required | HTML (form), else 303 → `/login` |
| POST | `/notes` | `createNote` | required | 303 → `/` on success (note stamped with `user_id`), 422 HTML on invalid, else 303 → `/login` |
| GET | `/notes/:id/edit` | `editNote` | required | HTML (form pre-filled), 404 if the note doesn't exist **or belongs to another user**, else 303 → `/login` |
| POST | `/notes/:id/edit` | `updateNote` | required | 303 → `/?flash=Note+saved.` on success, 422 HTML on invalid, 404 if not the owner, else 303 → `/login` |
| POST | `/notes/:id/delete` | `deleteNote` | required | 303 → `/?flash=Note+deleted.` on success, 404 if not the owner, else 303 → `/login` |
| GET | `/signup` | `signup` | optional | HTML (form) |
| POST | `/signup` | `createUser` | optional | 303 → `/success` on success, 422 HTML on invalid or duplicate email |
| GET | `/login` | `login` | optional | HTML (form) |
| POST | `/login` | `createLogin` | optional | 303 → `/` with `Set-Cookie: session_id=...` on success, 422 HTML ("Email or password is incorrect.") on any failure |
| POST | `/logout` | `logout` | optional | 303 → `/` and clears `session_id` cookie (no-op if no cookie was set) |
| GET | `/success` | `success` | optional | HTML (account-created confirmation, links to `/login`) |
| GET | `/ok` | static `Response` | — | `"OK"` |
| any | `/*` | (inline) | — | static file from `./public` or `notFound()` (404 page) |
| — | (fallback) | (inline) | — | 404 page |

**Nav:** rendered by `renderNav(user)` and injected into the layout via the `{{nav}}` slot. Logged in: Home / About / New Note / `POST /logout` button. Logged out: Home / About / Sign Up / Log In.

**Flash messages:** `updateNote` and `deleteNote` redirect to `/?flash=...`. `home` reads the `flash` query param and renders it inside `<p class="flash">` with `escapeHtml` so user-supplied values can't inject markup. There is no server-side flash store — the message lives only in the redirect URL.

**Ownership invariant:** every note SQL touches `user_id`. Reading another user's note returns 404 (not 403) so the existence of the row is not leaked.

The session cookie is set with `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, and `maxAge` matching the session's `expires_at`. `req.cookies` is a `Bun.CookieMap`; any `set`/`delete` against it is applied to the response automatically by `Bun.serve`. (Note: `bun-types` does not currently type `Request.cookies` or `Request.params`, even though they work at runtime — `tsc --noEmit` reports "Property 'cookies' does not exist on type 'Request'" on four call sites in `users.ts` and "Property 'params' does not exist on type 'Request'" on the three `req.params.id` sites in `routes.ts`. Behavior is unaffected.)

## Tests

Tests are split across five files (one per module), reset between every test via a top-level `beforeEach` in `server.test.ts`.

### `server.test.ts` — integration tests (HTTP via `fetch`)

Imports `./index.ts` for side-effect server start and `db` from `./db.ts` for table resets (`DELETE FROM notes`, `DELETE FROM users`, `DELETE FROM sessions`).

Local helpers: `signUp(email, password)` POSTs to `/signup`; `loginAs(email, password)` signs up + logs in and returns a `session_id=...` cookie string ready to drop into a `cookie` header; `sessionCookie(res)` extracts the `session_id` value out of a `Set-Cookie` header via regex.

- `describe("server routes")` — 3 tests: about page returns 200, `/ok` returns `"OK"`, public stylesheet has `text/css` content type.
- `describe("notes")` — 4 tests: GET `/notes/new` returns the form (requires login), POST `/notes` redirects, submitted notes appear on home, user input is escaped.
- `describe("validation and errors")` — 5 tests: empty title / empty body / preserved input / no DB write on invalid / styled 404 for unknown routes.
- `describe("sign up")` — 6 tests: GET form, successful sign up stores an argon2id hash, hash verifies with `Bun.password.verify`, short password keeps the email but drops the password from the response, mismatched passwords, duplicate email returns a friendly error with only one row in the DB.
- `describe("login and logout")` — 6 tests: GET form, valid login sets the cookie and writes a `sessions` row, wrong password returns the same error as unknown email (privacy property pinned), logout clears the cookie + row, logout without a session no-ops.
- `describe("ownership")` — 8 tests: welcome message when logged out, user's notes when logged in, one user does not see another's notes, `/notes/new` and POST `/notes` redirect to `/login` when logged out, created notes are stamped with the current `user.id`, nav switches based on auth state (both directions).
- `describe("edit and delete")` — 10 tests: edit form pre-fills, POST edit updates + redirects with `?flash=Note+saved.`, empty title returns 422 + keeps the original row, delete removes + redirects with `?flash=Note+deleted.`, home renders the flash, flash value is HTML-escaped (XSS pinned), a user cannot edit or delete another user's note (404, row unchanged), edit/delete on a missing id returns 404, edit/delete redirect to `/login` when logged out.
- `describe("search and pagination")` — 10 tests: search filters by substring in title and in body, no-match search renders a friendly empty message that names the (escaped) query, the search query is HTML-escaped in both the input value and the empty message, search is scoped to the current user (one user's matching note doesn't appear in another's results), `/` caps the list at 10 with a "Page 1 of N" indicator, `?page=2` shows the older notes (relies on the `id DESC` tiebreaker for stable order), the pager doesn't render at all when everything fits on one page, search and pagination compose (the pager link preserves `q`), and `?page=0` / `?page=banana` both fall back to page 1.

### `routes.test.ts` — unit tests for `validateNote`

6 tests: accepts a normal note, rejects empty title / whitespace title / empty body / title over 200 chars, returns multiple errors at once.

### `users.test.ts` — unit tests for `validateSignup`

5 tests: accepts valid input, rejects empty email, missing `@`, password under 8 chars, mismatched confirmation.

### `templates.test.ts` — unit tests for templating

12 tests: `escapeHtml` covers all five HTML special chars and leaves safe text alone; `renderForm` defaults to empty fields with no error list, round-trips user input safely (including escaping `&amp;` → `&amp;amp;`), and shows the error list when given errors; `renderNav` renders the logged-in nav for a `User` and the logged-out nav for `null`; `renderPager` returns `""` for a single page, links forward / back at the appropriate ends, disables prev on page 1 and next on the last page, and carries the `q` query param through into the prev/next URLs.

### `wordcount.test.ts` — leftover from Chapter 4

6 tests for `countWords`. Not wired into the server.

**Test totals:** 81 tests across 5 files (server: 52, routes: 6, users: 5, templates: 12, wordcount: 6). Last run requires port 3000 to be free (`server.test.ts` boots `Bun.serve` on a fixed port via `import "./index.ts"`); a stray `bun --watch` process will cause an `EADDRINUSE` error in that file.

## Known type errors (TS only — runtime is fine)

`bunx tsc --noEmit` currently surfaces:

- `routes.ts` 3× `Property 'params' does not exist on type 'Request'` — `req.params.id` in `editNote` / `updateNote` / `deleteNote`. `bun-types` gap.
- `users.ts` 4× `Property 'cookies' does not exist on type 'Request'` — same `bun-types` gap.
- `server.test.ts` 1× `Type 'string | undefined' is not assignable to type 'string | null'` — the `sessionCookie` regex-match return.

None of these block `bun test` or `bun run`.
