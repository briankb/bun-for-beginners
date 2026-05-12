// templates.ts
import { db } from "./db";
import type { User } from "./users";

const layout = await Bun.file("./layout.html").text();

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

function renderNav(user: User | null): string {
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

export function renderForm(
  values: { title: string; body: string } = { title: "", body: "" },
  errors: string[] = [],
): string {
  const errorList =
    errors.length === 0
      ? ""
      : `<ul class="errors">${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join("")}</ul>`;

  return `<h1>New Note</h1>
${errorList}
<form method="POST" action="/notes">
  <label for="title">Title</label>
  <input id="title" name="title" type="text" value="${escapeHtml(values.title)}" required />

  <label for="body">Body</label>
  <textarea id="body" name="body" required>${escapeHtml(values.body)}</textarea>

  <button type="submit">Save Note</button>
</form>`;
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
