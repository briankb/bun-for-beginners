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

export function renderPager(
  page: number,
  pageCount: number,
  q: string,
): string {
  if (pageCount <= 1) return "";

  const params = (n: number) => {
    const search = new URLSearchParams();
    if (q !== "") search.set("q", q);
    if (n !== 1) search.set("page", String(n));
    const s = search.toString();
    return s === "" ? "/" : `/?${s}`;
  };

  const prev =
    page > 1
      ? `<a href="${escapeHtml(params(page - 1))}" class="prev">Prev</a>`
      : `<span class="prev disabled">Prev</span>`;

  const next =
    page < pageCount
      ? `<a href="${escapeHtml(params(page + 1))}" class="next">Next</a>`
      : `<span class="next disabled">Next</span>`;

  return `<nav class="pager">
    ${prev}
    <span class="page-info">Page ${page} of ${pageCount}</span>
    ${next}
  </nav>`;
}
