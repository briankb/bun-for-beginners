// index.ts
const layout = await Bun.file("./layout.html").text();

function page(title: string, body: string): Response {
  const html = layout
    .replaceAll("{{title}}", title)
    .replaceAll("{{body}}", body);
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export const server = Bun.serve({
  port: 3000,
  routes: {
    "/": () =>
      page("My Bun App", `<h1>Welcome</h1><p>This page is served by Bun.</p>`),
    "/about": () =>
      page("About", `<h1>About</h1><p>A simple site built with Bun.</p>`),
    "/ok": new Response("OK"),
    "/*": async (req) => {
      const url = new URL(req.url);
      const file = Bun.file(`./public${url.pathname}`);
      if (await file.exists()) {
        return new Response(file);
      }
      return new Response("Page not found", { status: 404 });
    },
  },
  fetch(req) {
    return new Response("Page not found", { status: 404 });
  },
});

if (import.meta.main) {
  console.log(`Server running at ${server.url}`);
}
