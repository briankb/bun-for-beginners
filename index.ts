// index.ts
import { home, about, newNote, createNote, success } from "./routes";
import { signup, createUser, login, createLogin, logout } from "./users";
import { notFound, page } from "./templates";

export const server = Bun.serve({
  port: 3000,
  routes: {
    "/": home,
    "/about": about,
    "/notes/new": newNote,
    "/notes": {
      POST: createNote,
    },
    "/signup": {
      GET: signup,
      POST: createUser,
    },
    "/login": {
      GET: login,
      POST: createLogin,
    },
    "/logout": {
      POST: logout,
    },
    "/success": success,
    "/ok": new Response("OK"),
    "/*": async (req) => {
      const url = new URL(req.url);
      const file = Bun.file(`./public${url.pathname}`);
      if (await file.exists()) {
        return new Response(file);
      }
      return notFound();
    },
  },
  fetch(req) {
    return notFound();
  },
  error(err) {
    console.error(err);
    return page(
      "Error",
      `<h1>Something went wrong</h1>
      <p>The server hit an error. <a href="/">Go home</a>.</p>`,
      { status: 500 },
    );
  },
});

if (import.meta.main) {
  console.log(`Server running at ${server.url}`);
}
