import { home, about, newNote, createNote } from "./routes";

export const server = Bun.serve({
  port: 3000,
  routes: {
    "/": home,
    "/about": about,
    "/notes/new": newNote,
    "/notes": {
      POST: createNote,
    },
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
