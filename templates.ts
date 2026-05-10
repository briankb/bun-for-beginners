// templates.ts
const layout = await Bun.file("./layout.html").text();

export function page(title: string, body: string): Response {
  const html = layout
    .replaceAll("{{title}}", title)
    .replaceAll("{{body}}", body);
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
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
