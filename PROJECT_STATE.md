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
- Private: two top-level `db.run(...)` calls execute `CREATE TABLE IF NOT EXISTS notes (...)` and `CREATE TABLE IF NOT EXISTS users (...)` at module load.

### `index.ts`

- `server: Server` — `Bun.serve` instance on port 3000 wiring `/`, `/about`, `/notes/new`, `POST /notes`, `/signup` (GET + POST), `/success`, `/ok`, a `/*` static-file fallback into `./public`, a `fetch` 404 fallback, and an `error` handler that renders a 500 page.
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
- Private: `insertUser` — prepared statement held at module scope; `validateSignup(email, password, passwordConfirm)` — returns an array of error strings for empty email, missing `@`, password shorter than 8 chars, and mismatched confirmation; `renderSignupForm(values?, errors?)` — renders the sign-up `<form>` with escaped email round-trip (password fields never round-trip) and an optional `<ul class="errors">` list.

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
```

`users.email` has a `UNIQUE` constraint — duplicate inserts throw a SQLite error containing `UNIQUE`, which `createUser` catches and turns into a 422 form error. `password_hash` stores the full self-describing `$argon2id$...` string from `Bun.password.hash` (algorithm, parameters, salt, hash). Passwords are never stored in plaintext and never round-trip into form values.

## Routes

| Method | Path | Handler | Response |
| --- | --- | --- | --- |
| GET | `/` | `home` | HTML |
| GET | `/about` | `about` | HTML |
| GET | `/notes/new` | `newNote` | HTML (form) |
| POST | `/notes` | `createNote` | 303 → `/` on success, 422 HTML (form with errors) on invalid |
| GET | `/signup` | `signup` | HTML (form) |
| POST | `/signup` | `createUser` | 303 → `/success` on success, 422 HTML (form with errors) on invalid or duplicate email |
| GET | `/success` | `success` | HTML (account-created confirmation) |
| GET | `/ok` | static `Response` | `"OK"` |
| any | `/*` | (inline) | static file from `./public` or `notFound()` (404 page) |
| — | (fallback) | (inline) | 404 page |

Nav links in `layout.html`: Home, About, New Note, Sign Up.

## Tests

**File:** `index.test.ts`. Imports `./index.ts` for side-effect server start, `db` from `./db` for table reset between tests. Top-level `beforeEach` runs `DELETE FROM notes` and `DELETE FROM users`.

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

**File:** `wordcount.test.ts`. Imports `countWords` from `./wordcount.ts` (the file duplicates the `bun:test` and `countWords` imports at the top).

### `describe("countWords")`
- counts two words
- returns zero for an empty string
- counts a single word
- handles multiple spaces between words
- ignores leading and trailing whitespace
- handles tabs and newlines

Test totals: **27 tests across 2 files**, all passing on the latest run.
