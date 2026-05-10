// routes.ts
import { page, escapeHtml, renderForm } from "./templates";
import { db } from "./db";

export type Note = {
  id: number;
  title: string;
  body: string;
  created_at: number;
  updated_at: number;
};

const listNotes = db.query("SELECT * FROM notes ORDER BY created_at DESC");
const insertNote = db.prepare("INSERT INTO notes (title, body) VALUES (?, ?)");

export const home = () => {
  const notes = listNotes.all() as Note[];
  const list = notes
    .map(
      (n) =>
        `<li><strong>${escapeHtml(n.title)}:</strong> ${escapeHtml(n.body)}</li>`,
    )
    .join("");
  return page(
    "My Bun App",
    `<h1>Notes</h1>
    ${notes.length === 0 ? "<p>No notes yet.</p>" : `<ul>${list}</ul>`}`,
  );
};

export const about = () =>
  page("About", `<h1>About</h1><p>A simple site built with Bun.</p>`);

export const newNote = () => page("New Note", renderForm());

function validateNote(title: string, body: string): string[] {
  const errors: string[] = [];
  if (title.trim() === "") errors.push("Title is required.");
  if (body.trim() === "") errors.push("Body is required.");
  if (title.length > 200) errors.push("Title must be 200 characters or fewer.");
  return errors;
}

export const createNote = async (req: Request) => {
  const form = await req.formData();
  const title = String(form.get("title") ?? "");
  const body = String(form.get("body") ?? "");

  const errors = validateNote(title, body);
  if (errors.length > 0) {
    return page("New Note", renderForm({ title, body }, errors), {
      status: 422,
    });
  }

  insertNote.run(title, body);
  return Response.redirect("/", 303);
};
