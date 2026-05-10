// templates.ts
const layout = await Bun.file("./layout.html").text();

export function page(
  title: string,
  body: string,
  init?: ResponseInit,
): Response {
  const html = layout
    .replaceAll("{{title}}", title)
    .replaceAll("{{body}}", body);
  return new Response(html, {
    ...init,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ...(init?.headers ?? {}),
    },
  });
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
  <textarea id="body" name="body" rows="6" required>${escapeHtml(values.body)}</textarea>

  <button type="submit">Save</button>
</form>`;
}

export function notFound(): Response {
  return page(
    "Not Found",
    `<h1>Not found</h1>
    <p>That page does not exist. <a href="/">Go home</a>.</p>`,
    { status: 404 },
  );
}
