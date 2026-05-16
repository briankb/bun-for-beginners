// routes.ts
import {
  pageFor,
  escapeHtml,
  renderForm,
  renderPager,
  notFound,
} from "./templates";
import { db } from "./db";
import { currentUser } from "./users";

const PAGE_SIZE = 10;

export type Note = {
  id: number;
  user_id: number;
  title: string;
  body: string;
  created_at: number;
  updated_at: number;
};

const listNotes = db.query(
  "SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?",
);
const searchNotes = db.query(
  `SELECT * FROM notes
   WHERE user_id = ? AND (title LIKE ? OR body LIKE ?)
   ORDER BY created_at DESC, id DESC
   LIMIT ? OFFSET ?`,
);
const countNotes = db.query(
  "SELECT COUNT(*) AS n FROM notes WHERE user_id = ?",
);
const countSearchNotes = db.query(
  `SELECT COUNT(*) AS n FROM notes
   WHERE user_id = ? AND (title LIKE ? OR body LIKE ?)`,
);

const findNote = db.query("SELECT * FROM notes WHERE id = ? AND user_id = ?");
const insertNote = db.prepare(
  "INSERT INTO notes (user_id, title, body) VALUES (?, ?, ?)",
);
const updateNoteRow = db.prepare(
  "UPDATE notes SET title = ?, body = ?, updated_at = unixepoch() WHERE id = ? AND user_id = ?",
);
const deleteNoteRow = db.prepare(
  "DELETE FROM notes WHERE id = ? AND user_id = ?",
);

export function validateNote(title: string, body: string): string[] {
  const errors: string[] = [];
  if (title.trim() === "") errors.push("Title is required.");
  if (body.trim() === "") errors.push("Body is required.");
  if (title.length > 200) errors.push("Title must be 200 characters or less.");
  return errors;
}

export const home = (req: Request) => {
  const user = currentUser(req);
  const url = new URL(req.url);
  const flash = url.searchParams.get("flash");
  const q = url.searchParams.get("q") ?? "";
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

  if (!user) {
    return pageFor(
      null,
      "Home",
      `<h1>Welcome</h1>
      <p>This is a notes app. <a href="/signup">Sign up</a> or <a href="/login">log in</a> to start.</p>`,
    );
  }

  const offset = (page - 1) * PAGE_SIZE;
  const searching = q.trim() !== "";

  const notes = (
    searching
      ? searchNotes.all(user.id, `%${q}%`, `%${q}%`, PAGE_SIZE, offset)
      : listNotes.all(user.id, PAGE_SIZE, offset)
  ) as Note[];

  const total = (
    searching
      ? countSearchNotes.get(user.id, `%${q}%`, `%${q}%`)
      : countNotes.get(user.id)
  ) as { n: number };

  const pageCount = Math.max(1, Math.ceil(total.n / PAGE_SIZE));

  const emptyMessage = searching
    ? `<p>No notes match "${escapeHtml(q)}".</p>`
    : "<p>No notes yet.</p>";

  const list =
    notes.length === 0
      ? emptyMessage
      : `<ul>${notes
          .map(
            (n) =>
              `<li>
                <strong>${escapeHtml(n.title)}</strong>: ${escapeHtml(n.body)}
                <a href="/notes/${n.id}/edit">Edit</a>
                <form method="POST" action="/notes/${n.id}/delete" style="display:inline">
                  <button type="submit">Delete</button>
                </form>
              </li>`,
          )
          .join("")}</ul>`;

  const flashHtml = flash ? `<p class="flash">${escapeHtml(flash)}</p>` : "";

  const searchHtml = `<form method="GET" action="/" class="search">
    <input type="search" name="q" value="${escapeHtml(q)}" placeholder="Search notes" />
    <button type="submit">Search</button>
  </form>`;

  const pager = renderPager(page, pageCount, q);

  return pageFor(
    user,
    "Home",
    `<h1>Your notes</h1>${flashHtml}${searchHtml}${list}${pager}`,
  );
};

export const about = (req: Request) =>
  pageFor(
    currentUser(req),
    "About",
    `<h1>About</h1>
    <p>A tiny notes app built with Bun.</p>`,
  );

export const newNote = (req: Request) => {
  const user = currentUser(req);
  if (!user) return Response.redirect("/login", 303);
  return pageFor(user, "New Note", renderForm());
};

export const createNote = async (req: Request) => {
  const user = currentUser(req);
  if (!user) return Response.redirect("/login", 303);

  const form = await req.formData();
  const title = String(form.get("title") ?? "");
  const body = String(form.get("body") ?? "");

  const errors = validateNote(title, body);
  if (errors.length > 0) {
    return pageFor(user, "New Note", renderForm({ title, body }, errors), {
      status: 422,
    });
  }

  insertNote.run(user.id, title, body);
  return Response.redirect("/", 303);
};

export const editNote = (req: Request) => {
  const user = currentUser(req);
  if (!user) return Response.redirect("/login", 303);

  const id = Number(req.params.id);
  const note = findNote.get(id, user.id) as Note | null;
  if (!note) return notFound();

  return pageFor(
    user,
    "Edit Note",
    renderForm({ title: note.title, body: note.body }, [], {
      action: `/notes/${note.id}/edit`,
      heading: "Edit Note",
      submit: "Save Changes",
    }),
  );
};

export const updateNote = async (req: Request) => {
  const user = currentUser(req);
  if (!user) return Response.redirect("/login", 303);

  const id = Number(req.params.id);
  const note = findNote.get(id, user.id) as Note | null;
  if (!note) return notFound();

  const form = await req.formData();
  const title = String(form.get("title") ?? "");
  const body = String(form.get("body") ?? "");

  const errors = validateNote(title, body);
  if (errors.length > 0) {
    return pageFor(
      user,
      "Edit Note",
      renderForm({ title, body }, errors, {
        action: `/notes/${note.id}/edit`,
        heading: "Edit Note",
        submit: "Save Changes",
      }),
      { status: 422 },
    );
  }

  updateNoteRow.run(title, body, note.id, user.id);
  return Response.redirect("/?flash=Note+saved.", 303);
};

export const deleteNote = (req: Request) => {
  const user = currentUser(req);
  if (!user) return Response.redirect("/login", 303);

  const id = Number(req.params.id);
  const note = findNote.get(id, user.id) as Note | null;
  if (!note) return notFound();

  deleteNoteRow.run(note.id, user.id);
  return Response.redirect("/?flash=Note+deleted.", 303);
};

export const success = (req: Request) =>
  pageFor(
    currentUser(req),
    "Account Created",
    `<h1>Account created</h1>
    <p>Your account is ready. <a href="/login">Log in</a> to start taking notes.</p>`,
  );
