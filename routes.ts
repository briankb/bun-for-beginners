// routes.ts
import { page, escapeHtml } from "./templates";
import { db } from "./db";

const formHtml = await Bun.file("./form.html").text();

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

export const newNote = () => page("New Note", formHtml);

export const createNote = async (req: Request) => {
  const form = await req.formData();
  const title = String(form.get("title"));
  const body = String(form.get("body"));
  insertNote.run(title, body);
  return Response.redirect("/", 303);
};
