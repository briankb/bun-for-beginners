## File tree

```
.
├── about.html
├── db.ts
├── form.html
├── home.html
├── index.test.ts
├── index.ts
├── layout.html
├── package.json
├── public/
│   └── style.css
├── README.md
├── routes.ts
├── sessions.ts
├── templates.ts
├── tree-view-end-of-chapter-08.txt
├── tsconfig.json
├── users.ts
├── wordcount.test.ts
└── wordcount.ts
```

*Not shown: `node_modules/`, `bun.lock`, `notes.db`, `notes.test.db`, and SQLite `-wal`/`-shm` sidecars (all gitignored).*

*Other files on disk worth noting: `wordcount.ts` and `wordcount.test.ts` (from Chapters 3–4, no longer used by the server).*

*`form.html` is still on disk — Chapter 8 deleted it from the narrative; if the reader's commit didn't pick it up, it's harmless but stale.*

## Module exports

### `db.ts`

- `db: Database` — SQLite database opened at `process.env.DB_PATH ?? "notes.db"` with `create: true`.
- Private: three top-level `db.run(...)` calls execute `CREATE TABLE IF NOT EXISTS notes (...)`, `CREATE TABLE IF NOT EXISTS users (...)`, and `CREATE TABLE IF NOT EXISTS sessions (...)` at module load.

### `index.ts`

- `server: Server` — `Bun.serve` instance on port 3000 wiring `/`, `/about`, `/notes/new`, `POST /notes`, `/signup` (GET + POST), `/login` (GET + POST), `POST /logout`, `/success`, `/ok`, a `/*` static-file fallback into `./public`, a `fetch` 404 fallback, and an `error` handler that renders a 500 page.
- Private: `import.meta.main` guard that logs the server URL when the module is the entrypoint.

### `routes.ts`

- `type Note` — DB row shape (`id`, `title`, `body`, `created_at`, `updated_at`).
- `home()` — Selects all notes ordered by `created_at DESC` and renders them as an escaped `<ul>` (or "No notes yet.") inside the page layout.
- `about()` — Returns the static About page.
- `newNote()` — Returns the page wrapping `renderForm()` with empty values.
- `createNote(req: Request): Promise<Response>` — Parses the form body, calls `validateNote`, re-renders the form with errors at status 422 if invalid, otherwise inserts the note and returns a 303 redirect to `/`.
- `success()` — Returns the "Account created" confirmation page with a link home.
- Private: `listNotes`, `insertNote` — prepared statements held at module scope; `validateNote(title, body)` — returns an array of error strings for empty title/body and title length > 200.

### `users.ts`

- `type User` — DB row shape (`id`, `email`, `password_hash`, `created_at`, `updated_at`).
- `signup()` — Returns the page wrapping the sign-up form with empty values and no errors.
- `createUser(req: Request): Promise<Response>` — Parses the form body, calls `validateSignup`, re-renders the form with errors at status 422 if invalid; otherwise hashes the password with `Bun.password.hash` (argon2id default), inserts the user, catches `UNIQUE` constraint errors to render an "Email already registered." 422, and returns a 303 redirect to `/success` on success. Non-UNIQUE errors are re-thrown to the server's `error` handler.
- `login()` — Returns the page wrapping the login form with empty values and no errors.
- `createLogin(req: Request): Promise<Response>` — Parses the form body, returns a single "Email or password is incorrect." 422 for empty fields, unknown email, or wrong password (no leak about which case it was). On success, calls `createSession(user.id)` and sets a `session_id` cookie via `req.cookies.set(...)` with `httpOnly`, `sameSite: "lax"`, `path: "/"`, and `maxAge` matching the session lifetime, then returns a 303 redirect to `/`.
- `currentUser(req: Request): User | null` — Reads `session_id` from `req.cookies`, looks up the session via `findSessionById` (which already filters on `expires_at > unixepoch()`), then looks up the user. Returns `null` if cookie/session/user is missing or expired. Not yet wired into any handler — Chapter 11 will use it.
- `logout(req: Request): Response` — Reads `session_id` from `req.cookies`, calls `endSession` and `req.cookies.delete("session_id")` if present, and returns a 303 redirect to `/`. No-ops gracefully when no cookie is present.
- Private: `insertUser`, `findUserByEmail`, `findUserById` — prepared statements held at module scope; `validateSignup(email, password, passwordConfirm)` — returns an array of error strings for empty email, missing `@`, password shorter than 8 chars, and mismatched confirmation; `renderSignupForm(values?, errors?)` — renders the sign-up `<form>` with escaped email round-trip (password fields never round-trip) and an optional `<ul class="errors">` list; `renderLoginForm(values?, errors?)` — same shape as `renderSignupForm` but with only an email field plus password (no confirm).

### `sessions.ts`

- `type Session` — DB row shape (`id: string`, `user_id: number`, `created_at: number`, `expires_at: number`).
- `createSession(userId: number): Session` — Generates a session ID with `randomUUIDv7()` from `"bun"`, sets `expires_at` to now + 30 days (`SESSION_DURATION_SECONDS`), inserts a row, and returns the new session.
- `findSessionById(id: string): Session | null` — Looks up a session by ID with `expires_at > unixepoch()` baked into the query, so an expired session is indistinguishable from a missing one.
- `endSession(id: string): void` — `DELETE FROM sessions WHERE id = ?`. Does not check the row existed.
- Private: `SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30` (30 days); `insertSession`, `findSession`, `deleteSession` — prepared statements/queries held at module scope.

### `templates.ts`

- `page(title: string, body: string, init?: ResponseInit): Response` — Replaces `{{title}}` and `{{body}}` in the layout HTML and returns an HTML Response with `Content-Type: text/html; charset=utf-8`, merging any caller-supplied `init`.
- `escapeHtml(s: string): string` — Replaces `& < > " '` with their HTML entity references.
- `renderForm(values?: { title: string; body: string }, errors?: string[]): string` — Returns the new-note `<form>` HTML, escaping prefilled values and prefixing an `<ul class="errors">` list when errors are present.
- `notFound(): Response` — Returns the styled 404 page via `page(...)` with status 404.
- Private: top-level `await Bun.file("./layout.html").text()` reads the layout template once at module load.

## Database schema

```sql
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

`users.email` has a `UNIQUE` constraint — duplicate inserts throw a SQLite error containing `UNIQUE`, which `createUser` catches and turns into a 422 form error. `password_hash` stores the full self-describing `$argon2id$...` string from `Bun.password.hash` (algorithm, parameters, salt, hash). Passwords are never stored in plaintext and never round-trip into form values.

`sessions.id` is a `TEXT PRIMARY KEY` populated by `randomUUIDv7()` so the ID is unguessable — the cookie ships the ID directly and a sequential integer would be hijackable. There is no `updated_at` (a session is created and eventually deleted, never edited). `expires_at` is a Unix timestamp; `findSessionById` filters on `expires_at > unixepoch()`, so an expired session is treated the same as a missing one.

## Routes

| Method | Path | Handler | Response |
| --- | --- | --- | --- |
| GET | `/` | `home` | HTML |
| GET | `/about` | `about` | HTML |
| GET | `/notes/new` | `newNote` | HTML (form) |
| POST | `/notes` | `createNote` | 303 → `/` on success, 422 HTML (form with errors) on invalid |
| GET | `/signup` | `signup` | HTML (form) |
| POST | `/signup` | `createUser` | 303 → `/success` on success, 422 HTML (form with errors) on invalid or duplicate email |
| GET | `/login` | `login` | HTML (form) |
| POST | `/login` | `createLogin` | 303 → `/` with `Set-Cookie: session_id=...` on success, 422 HTML ("Email or password is incorrect.") on any failure |
| POST | `/logout` | `logout` | 303 → `/` and clears `session_id` cookie (no-op if no cookie was set) |
| GET | `/success` | `success` | HTML (account-created confirmation) |
| GET | `/ok` | static `Response` | `"OK"` |
| any | `/*` | (inline) | static file from `./public` or `notFound()` (404 page) |
| — | (fallback) | (inline) | 404 page |

Nav links in `layout.html`: Home, About, New Note, Sign Up, Log In, and an inline `POST /logout` button. Every link is always visible regardless of auth state — Chapter 11 will hide what does not apply.

The session cookie is set with `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, and `maxAge` matching the session's `expires_at`. `req.cookies` is a `Bun.CookieMap`; any `set`/`delete` against it is applied to the response automatically by `Bun.serve`. (Note: `bun-types` does not currently type `Request.cookies` even though it works at runtime — TS reports "Property 'cookies' does not exist on type 'Request'" on the four call sites in `users.ts`; behavior is unaffected.)

## Tests

**File:** `index.test.ts`. Imports `./index.ts` for side-effect server start, `db` from `./db` for table reset between tests. Top-level `beforeEach` runs `DELETE FROM notes`, `DELETE FROM users`, and `DELETE FROM sessions`.

### `describe("server routes")`
- home page returns 200 with welcome text
- about page returns 200
- health check returns OK
- stylesheet is served from public folder
- unknown URL returns 404

### `describe("notes")`
- GET /notes/new returns the form
- POST /notes redirects to home
- submitted notes appear on the home page
- user input is escaped on the home page
- multiple notes appear in order

### `describe("validation and errors")`
- empty title returns the form with an error
- empty body returns the form with an error
- invalid form preserves the user's input
- invalid form does not write to the database
- missing route returns the styled 404 page

### `describe("sign up")`
- GET /signup returns the form
- valid sign up creates a user and redirects to /success (asserts row exists, hash is not plaintext, hash contains `$argon2id$`)
- stored hash verifies against the original password (asserts `Bun.password.verify` returns true for the right password and false for the wrong one)
- short password returns the form with an error (asserts email round-trips, password does **not** appear in the response)
- mismatched passwords return an error
- duplicate email returns a friendly error (asserts only one row exists after the second attempt)

### `describe("login and logout")`
- GET /login returns the form
- valid login sets a session cookie and redirects home (asserts 303 to `/`, a non-trivial `session_id` cookie value, and a matching row in `sessions`)
- wrong password returns the form with an error (asserts 422, error message, email round-trips, submitted password does **not** appear, and no session row was created)
- unknown email returns the same error as wrong password (pins the privacy property — error must not say "not registered")
- logout deletes the session row and clears the cookie (asserts 303, that `Set-Cookie` clears `session_id` via `max-age=0` or expiry, and the row is gone)
- logout without a session redirects home and does nothing (asserts 303 to `/` with no cookie set)

Local helpers inside the block: `signUp(email, password)` — POSTs to `/signup` to create the user under test; `sessionCookie(res)` — extracts the `session_id` value out of a `Set-Cookie` header via regex.

**File:** `wordcount.test.ts`. Imports `countWords` from `./wordcount.ts` (the file duplicates the `bun:test` and `countWords` imports at the top).

### `describe("countWords")`
- counts two words
- returns zero for an empty string
- counts a single word
- handles multiple spaces between words
- ignores leading and trailing whitespace
- handles tabs and newlines

Test totals: **33 tests across 2 files**, all passing on the latest run.
