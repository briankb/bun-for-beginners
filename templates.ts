// templates.ts
import { db } from "./db";
import type { User } from "./users";

const layout = await Bun.file("./layout.html").text();

type FormOptions = {
  action: string;
  heading: string;
  submit: string;
};

const NEW_NOTE_FORM: FormOptions = {
  action: "/notes",
  heading: "New Note",
  submit: "Save Note",
};

export function renderForm(
  values: { title: string; body: string } = { title: "", body: "" },
  errors: string[] = [],
  options: FormOptions = NEW_NOTE_FORM,
): string {
  const errorList =
    errors.length === 0
      ? ""
      : `<ul class="errors">${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>`;

  return `<h1>${escapeHtml(options.heading)}</h1>
${errorList}
<form method="POST" action="${escapeHtml(options.action)}">
  <label for="title">Title</label>
  <input id="title" name="title" type="text" value="${escapeHtml(values.title)}" required />

  <label for="body">Body</label>
  <textarea id="body" name="body" required>${escapeHtml(values.body)}</textarea>

  <button type="submit">${escapeHtml(options.submit)}</button>
</form>`;
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

export function page(
  title: string,
  body: string,
  init?: ResponseInit,
): Response {
  return new Response(
    layout.replace("{{title}}", title).replace("{{body}}", body),
    {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      ...init,
    },
  );
}

export function pageFor(
  user: User | null,
  title: string,
  body: string,
  init?: ResponseInit,
): Response {
  return new Response(
    layout
      .replace("{{title}}", title)
      .replace("{{nav}}", renderNav(user))
      .replace("{{body}}", body),
    {
      headers: { "Content-Type": "text/html; charset=utf-8" },
      ...init,
    },
  );
}

export function renderNav(user: User | null): string {
  if (user) {
    return `<nav>
      <a href="/">Home</a>
      <a href="/about">About</a>
      <a href="/notes/new">New Note</a>
      <form method="POST" action="/logout" style="display:inline">
        <button type="submit">Log Out</button>
      </form>
    </nav>`;
  }
  return `<nav>
    <a href="/">Home</a>
    <a href="/about">About</a>
    <a href="/signup">Sign Up</a>
    <a href="/login">Log In</a>
  </nav>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function notFound(): Response {
  return pageFor(
    null,
    "Not Found",
    `<h1>Not Found</h1>
    <p>That page does not exist. <a href="/">Go home</a>.</p>`,
    { status: 404 },
  );
}
