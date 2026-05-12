// routes.ts
import { pageFor, escapeHtml, renderForm, notFound } from "./templates";
import { db } from "./db";
import { currentUser } from "./users";

export type Note = {
  id: number;
  user_id: number;
  title: string;
  body: string;
  created_at: number;
  updated_at: number;
};

const listNotes = db.query(
  "SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC",
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
  const flash = new URL(req.url).searchParams.get("flash");

  if (!user) {
    return pageFor(
      null,
      "Home",
      `<h1>Welcome</h1>
      <p>This is a notes app. <a href="/signup">Sign up</a> or <a href="/login">log in</a> to start.</p>`,
    );
  }

  const notes = listNotes.all(user.id) as Note[];
  const list =
    notes.length === 0
      ? "<p>No notes yet.</p>"
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

  return pageFor(user, "Home", `<h1>Your notes</h1>${flashHtml}${list}`);
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
