// routes.ts
import { page, escapeHtml } from "./templates";

const formHtml = await Bun.file("./form.html").text();

export type Note = { id: number; title: string; body: string };
export const notes: Note[] = [];
let nextId = 1;

export const home = () => {
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
  notes.push({ id: nextId++, title, body });
  return Response.redirect("/", 303);
};
