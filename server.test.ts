// server.test.ts
import { describe, expect, test, beforeEach } from "bun:test";
import "./index.ts";
import { db } from "./db.ts";

beforeEach(() => {
  db.run("DELETE FROM notes");
  db.run("DELETE FROM users");
  db.run("DELETE FROM sessions");
});

async function signUp(email: string, password: string) {
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);
  form.set("password_confirm", password);
  await fetch("http://localhost:3000/signup", {
    method: "POST",
    body: form,
    redirect: "manual",
  });
}

function sessionCookie(res: Response): string | null {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return null;
  const match = setCookie.match(/session_id=([^;]+)/);
  return match ? match[1] : null;
}

async function loginAs(email: string, password: string): Promise<string> {
  await signUp(email, password);
  const form = new FormData();
  form.set("email", email);
  form.set("password", password);
  const res = await fetch("http://localhost:3000/login", {
    method: "POST",
    body: form,
    redirect: "manual",
  });
  const cookie = sessionCookie(res);
  if (!cookie) throw new Error("login failed");
  return `session_id=${cookie}`;
}

describe("server routes", () => {
  test("about page returns 200", async () => {
    const res = await fetch("http://localhost:3000/about");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("About");
  });

  test("health check returns OK", async () => {
    const res = await fetch("http://localhost:3000/ok");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("OK");
  });

  test("stylesheet is served from public folder", async () => {
    const res = await fetch("http://localhost:3000/style.css");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/css");
  });
});

describe("notes", () => {
  test("GET /notes/new returns the form", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    const res = await fetch("http://localhost:3000/notes/new", {
      headers: { cookie },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<form method="POST" action="/notes">');
  });

  test("POST /notes redirects to home", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    const form = new FormData();
    form.set("title", "Hello");
    form.set("body", "World");
    const res = await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      headers: { cookie },
      redirect: "manual",
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
  });

  test("submitted notes appear on the home page", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    const form = new FormData();
    form.set("title", "Buy milk");
    form.set("body", "Two percent");
    await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      headers: { cookie },
    });

    const res = await fetch("http://localhost:3000/", { headers: { cookie } });
    const html = await res.text();
    expect(html).toContain("Buy milk");
    expect(html).toContain("Two percent");
  });

  test("user input is escaped on the home page", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    const form = new FormData();
    form.set("title", "<script>alert(1)</script>");
    form.set("body", "ok");
    await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      headers: { cookie },
    });

    const res = await fetch("http://localhost:3000/", { headers: { cookie } });
    const html = await res.text();
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("validation and errors", () => {
  test("empty title returns the form with an error", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    const form = new FormData();
    form.set("title", "");
    form.set("body", "ok");
    const res = await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      headers: { cookie },
    });
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain("Title is required.");
  });

  test("empty body returns the form with an error", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    const form = new FormData();
    form.set("title", "ok");
    form.set("body", "");
    const res = await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      headers: { cookie },
    });
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain("Body is required.");
  });

  test("invalid form preserves the user's input", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    const form = new FormData();
    form.set("title", "kept");
    form.set("body", "");
    const res = await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      headers: { cookie },
    });
    const html = await res.text();
    expect(html).toContain('value="kept"');
  });

  test("invalid form does not write to the database", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    const form = new FormData();
    form.set("title", "");
    form.set("body", "");
    await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      headers: { cookie },
    });
    const count = db.query("SELECT COUNT(*) as n FROM notes").get() as {
      n: number;
    };
    expect(count.n).toBe(0);
  });

  test("missing route returns the styled 404 page", async () => {
    const res = await fetch("http://localhost:3000/does-not-exist");
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain("Not Found");
  });
});

describe("sign up", () => {
  test("GET /signup returns the form", async () => {
    const res = await fetch("http://localhost:3000/signup");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<form method="POST" action="/signup">');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
  });

  test("valid sign up creates a user and redirects to /success", async () => {
    const form = new FormData();
    form.set("email", "alice@example.com");
    form.set("password", "longenough");
    form.set("password_confirm", "longenough");

    const res = await fetch("http://localhost:3000/signup", {
      method: "POST",
      body: form,
      redirect: "manual",
    });

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/success");

    const row = db
      .query("SELECT email, password_hash FROM users WHERE email = ?")
      .get("alice@example.com") as { email: string; password_hash: string };

    expect(row.email).toBe("alice@example.com");
    expect(row.password_hash).not.toBe("longenough");
    expect(row.password_hash).toContain("$argon2id$");
  });

  test("stored hash verifies against the original password", async () => {
    const form = new FormData();
    form.set("email", "bob@example.com");
    form.set("password", "anotherlongpassword");
    form.set("password_confirm", "anotherlongpassword");

    await fetch("http://localhost:3000/signup", {
      method: "POST",
      body: form,
      redirect: "manual",
    });

    const row = db
      .query("SELECT password_hash FROM users WHERE email = ?")
      .get("bob@example.com") as { password_hash: string };

    expect(
      await Bun.password.verify("anotherlongpassword", row.password_hash),
    ).toBe(true);
    expect(await Bun.password.verify("wrong", row.password_hash)).toBe(false);
  });

  test("short password returns the form with an error", async () => {
    const form = new FormData();
    form.set("email", "carol@example.com");
    form.set("password", "short");
    form.set("password_confirm", "short");

    const res = await fetch("http://localhost:3000/signup", {
      method: "POST",
      body: form,
      redirect: "manual",
    });

    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain("Password must be at least 8 characters.");
    expect(html).toContain('value="carol@example.com"');
    expect(html).not.toContain("short");
  });

  test("mismatched passwords return an error", async () => {
    const form = new FormData();
    form.set("email", "dave@example.com");
    form.set("password", "longenough");
    form.set("password_confirm", "different1");

    const res = await fetch("http://localhost:3000/signup", {
      method: "POST",
      body: form,
      redirect: "manual",
    });

    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain("Passwords do not match.");
  });

  test("duplicate email returns a friendly error", async () => {
    const first = new FormData();
    first.set("email", "eve@example.com");
    first.set("password", "longenough");
    first.set("password_confirm", "longenough");

    await fetch("http://localhost:3000/signup", {
      method: "POST",
      body: first,
      redirect: "manual",
    });

    const second = new FormData();
    second.set("email", "eve@example.com");
    second.set("password", "anotherlong");
    second.set("password_confirm", "anotherlong");

    const res = await fetch("http://localhost:3000/signup", {
      method: "POST",
      body: second,
      redirect: "manual",
    });

    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain("Email already registered.");

    const count = db
      .query("SELECT COUNT(*) as n FROM users WHERE email = ?")
      .get("eve@example.com") as { n: number };
    expect(count.n).toBe(1);
  });
});

describe("login and logout", () => {
  test("GET /login returns the form", async () => {
    const res = await fetch("http://localhost:3000/login");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<form method="POST" action="/login">');
    expect(html).toContain('name="email"');
    expect(html).toContain('name="password"');
  });

  test("valid login sets a session cookie and redirects home", async () => {
    await signUp("alice@example.com", "longenough");

    const form = new FormData();
    form.set("email", "alice@example.com");
    form.set("password", "longenough");

    const res = await fetch("http://localhost:3000/login", {
      method: "POST",
      body: form,
      redirect: "manual",
    });

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");

    const cookie = sessionCookie(res);
    expect(cookie).not.toBeNull();
    expect(cookie!.length).toBeGreaterThan(10);

    const row = db
      .query("SELECT user_id FROM sessions WHERE id = ?")
      .get(cookie!) as { user_id: number } | null;
    expect(row).not.toBeNull();
  });

  test("wrong password returns the form with an error", async () => {
    await signUp("bob@example.com", "longenough");

    const form = new FormData();
    form.set("email", "bob@example.com");
    form.set("password", "wrongpassword");

    const res = await fetch("http://localhost:3000/login", {
      method: "POST",
      body: form,
      redirect: "manual",
    });

    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain("Email or password is incorrect.");
    expect(html).toContain('value="bob@example.com"');
    expect(html).not.toContain("wrongpassword");

    const count = db.query("SELECT COUNT(*) as n FROM sessions").get() as {
      n: number;
    };
    expect(count.n).toBe(0);
  });

  test("unknown email returns the same error as wrong password", async () => {
    const form = new FormData();
    form.set("email", "nobody@example.com");
    form.set("password", "longenough");

    const res = await fetch("http://localhost:3000/login", {
      method: "POST",
      body: form,
      redirect: "manual",
    });

    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain("Email or password is incorrect.");
    expect(html).not.toContain("not registered");
  });

  test("logout deletes the session row and clears the cookie", async () => {
    await signUp("carol@example.com", "longenough");

    const loginForm = new FormData();
    loginForm.set("email", "carol@example.com");
    loginForm.set("password", "longenough");

    const loginRes = await fetch("http://localhost:3000/login", {
      method: "POST",
      body: loginForm,
      redirect: "manual",
    });
    const cookie = sessionCookie(loginRes)!;

    const logoutRes = await fetch("http://localhost:3000/logout", {
      method: "POST",
      headers: { cookie: `session_id=${cookie}` },
      redirect: "manual",
    });

    expect(logoutRes.status).toBe(303);
    expect(logoutRes.headers.get("location")).toBe("/");

    const setCookie = logoutRes.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("session_id=");
    expect(setCookie.toLowerCase()).toMatch(/max-age=0|expires=/);

    const row = db.query("SELECT id FROM sessions WHERE id = ?").get(cookie);
    expect(row).toBeNull();
  });

  test("logout without a session redirects home and does nothing", async () => {
    const res = await fetch("http://localhost:3000/logout", {
      method: "POST",
      redirect: "manual",
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
  });
});

describe("ownership", () => {
  test("home page shows the welcome message when logged out", async () => {
    const res = await fetch("http://localhost:3000/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Welcome");
    expect(html).not.toContain("Your notes");
  });

  test("home page shows the user's notes when logged in", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    const form = new FormData();
    form.set("title", "alice-note");
    form.set("body", "x");
    await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      headers: { cookie },
    });

    const res = await fetch("http://localhost:3000/", { headers: { cookie } });
    const html = await res.text();
    expect(html).toContain("Your notes");
    expect(html).toContain("alice-note");
  });

  test("a user does not see another user's notes", async () => {
    const aliceCookie = await loginAs("alice@example.com", "longenough");
    const aliceForm = new FormData();
    aliceForm.set("title", "alice-note");
    aliceForm.set("body", "x");
    await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: aliceForm,
      headers: { cookie: aliceCookie },
    });

    const bobCookie = await loginAs("bob@example.com", "longenough");
    const bobForm = new FormData();
    bobForm.set("title", "bob-note");
    bobForm.set("body", "y");
    await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: bobForm,
      headers: { cookie: bobCookie },
    });

    const aliceHome = await fetch("http://localhost:3000/", {
      headers: { cookie: aliceCookie },
    });
    const aliceHtml = await aliceHome.text();
    expect(aliceHtml).toContain("alice-note");
    expect(aliceHtml).not.toContain("bob-note");

    const bobHome = await fetch("http://localhost:3000/", {
      headers: { cookie: bobCookie },
    });
    const bobHtml = await bobHome.text();
    expect(bobHtml).toContain("bob-note");
    expect(bobHtml).not.toContain("alice-note");
  });

  test("GET /notes/new redirects to /login when logged out", async () => {
    const res = await fetch("http://localhost:3000/notes/new", {
      redirect: "manual",
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/login");
  });

  test("POST /notes redirects to /login when logged out", async () => {
    const form = new FormData();
    form.set("title", "x");
    form.set("body", "y");
    const res = await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      redirect: "manual",
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/login");

    const count = db.query("SELECT COUNT(*) as n FROM notes").get() as {
      n: number;
    };
    expect(count.n).toBe(0);
  });

  test("created notes are stamped with the current user's id", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    const form = new FormData();
    form.set("title", "stamped");
    form.set("body", "y");
    await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      headers: { cookie },
    });

    const user = db
      .query("SELECT id FROM users WHERE email = ?")
      .get("alice@example.com") as { id: number };
    const note = db
      .query("SELECT user_id FROM notes WHERE title = ?")
      .get("stamped") as { user_id: number };
    expect(note.user_id).toBe(user.id);
  });

  test("nav shows Sign Up and Log In when logged out", async () => {
    const res = await fetch("http://localhost:3000/");
    const html = await res.text();
    expect(html).toContain('href="/signup"');
    expect(html).toContain('href="/login"');
    expect(html).not.toContain('href="/notes/new"');
    expect(html).not.toContain('action="/logout"');
  });

  test("nav shows New Note and Log Out when logged in", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    const res = await fetch("http://localhost:3000/", { headers: { cookie } });
    const html = await res.text();
    expect(html).toContain('href="/notes/new"');
    expect(html).toContain('action="/logout"');
    expect(html).not.toContain('href="/signup"');
    expect(html).not.toContain('href="/login"');
  });
});

describe("edit and delete", () => {
  async function createNoteFor(cookie: string, title: string, body: string) {
    const form = new FormData();
    form.set("title", title);
    form.set("body", body);
    await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      headers: { cookie },
    });
    const note = db
      .query("SELECT id FROM notes WHERE title = ?")
      .get(title) as { id: number };
    return note.id;
  }

  test("GET /notes/:id/edit returns the form pre-filled", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    const id = await createNoteFor(cookie, "original", "first body");

    const res = await fetch(`http://localhost:3000/notes/${id}/edit`, {
      headers: { cookie },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Edit Note");
    expect(html).toContain('value="original"');
    expect(html).toContain("first body");
    expect(html).toContain(`action="/notes/${id}/edit"`);
  });

  test("POST /notes/:id/edit updates the note and redirects with a flash", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    const id = await createNoteFor(cookie, "before", "before body");

    const form = new FormData();
    form.set("title", "after");
    form.set("body", "after body");

    const res = await fetch(`http://localhost:3000/notes/${id}/edit`, {
      method: "POST",
      body: form,
      headers: { cookie },
      redirect: "manual",
    });

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/?flash=Note+saved.");

    const row = db
      .query("SELECT title, body FROM notes WHERE id = ?")
      .get(id) as { title: string; body: string };
    expect(row.title).toBe("after");
    expect(row.body).toBe("after body");
  });

  test("POST /notes/:id/edit with empty title returns the form with an error", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    const id = await createNoteFor(cookie, "kept", "kept body");

    const form = new FormData();
    form.set("title", "");
    form.set("body", "new body");

    const res = await fetch(`http://localhost:3000/notes/${id}/edit`, {
      method: "POST",
      body: form,
      headers: { cookie },
    });
    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain("Title is required.");

    const row = db.query("SELECT title FROM notes WHERE id = ?").get(id) as {
      title: string;
    };
    expect(row.title).toBe("kept");
  });

  test("POST /notes/:id/delete removes the note and redirects with a flash", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    const id = await createNoteFor(cookie, "doomed", "x");

    const res = await fetch(`http://localhost:3000/notes/${id}/delete`, {
      method: "POST",
      headers: { cookie },
      redirect: "manual",
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/?flash=Note+deleted.");

    const row = db.query("SELECT id FROM notes WHERE id = ?").get(id);
    expect(row).toBeNull();
  });

  test("home page shows the flash message from the query string", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    const res = await fetch("http://localhost:3000/?flash=Note+saved.", {
      headers: { cookie },
    });
    const html = await res.text();
    expect(html).toContain('class="flash"');
    expect(html).toContain("Note saved.");
  });

  test("flash message is HTML-escaped", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    const res = await fetch(
      "http://localhost:3000/?flash=%3Cscript%3Ealert(1)%3C%2Fscript%3E",
      { headers: { cookie } },
    );
    const html = await res.text();
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("a user cannot edit another user's note", async () => {
    const aliceCookie = await loginAs("alice@example.com", "longenough");
    const id = await createNoteFor(aliceCookie, "alice-only", "secret");

    const bobCookie = await loginAs("bob@example.com", "longenough");

    const getRes = await fetch(`http://localhost:3000/notes/${id}/edit`, {
      headers: { cookie: bobCookie },
    });
    expect(getRes.status).toBe(404);

    const form = new FormData();
    form.set("title", "hacked");
    form.set("body", "hacked");
    const postRes = await fetch(`http://localhost:3000/notes/${id}/edit`, {
      method: "POST",
      body: form,
      headers: { cookie: bobCookie },
    });
    expect(postRes.status).toBe(404);

    const row = db.query("SELECT title FROM notes WHERE id = ?").get(id) as {
      title: string;
    };
    expect(row.title).toBe("alice-only");
  });

  test("a user cannot delete another user's note", async () => {
    const aliceCookie = await loginAs("alice@example.com", "longenough");
    const id = await createNoteFor(aliceCookie, "alice-keeps", "x");

    const bobCookie = await loginAs("bob@example.com", "longenough");
    const res = await fetch(`http://localhost:3000/notes/${id}/delete`, {
      method: "POST",
      headers: { cookie: bobCookie },
    });
    expect(res.status).toBe(404);

    const row = db.query("SELECT id FROM notes WHERE id = ?").get(id);
    expect(row).not.toBeNull();
  });

  test("editing or deleting a missing note returns 404", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");

    const getRes = await fetch("http://localhost:3000/notes/9999/edit", {
      headers: { cookie },
    });
    expect(getRes.status).toBe(404);

    const deleteRes = await fetch("http://localhost:3000/notes/9999/delete", {
      method: "POST",
      headers: { cookie },
    });
    expect(deleteRes.status).toBe(404);
  });

  test("edit and delete redirect to /login when logged out", async () => {
    const editRes = await fetch("http://localhost:3000/notes/1/edit", {
      redirect: "manual",
    });
    expect(editRes.status).toBe(303);
    expect(editRes.headers.get("location")).toBe("/login");

    const deleteRes = await fetch("http://localhost:3000/notes/1/delete", {
      method: "POST",
      redirect: "manual",
    });
    expect(deleteRes.status).toBe(303);
    expect(deleteRes.headers.get("location")).toBe("/login");
  });
});

describe("search and pagination", () => {
  async function createNoteFor(cookie: string, title: string, body: string) {
    const form = new FormData();
    form.set("title", title);
    form.set("body", body);
    await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      headers: { cookie },
    });
  }

  test("search filters notes by a substring in the title", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    await createNoteFor(cookie, "groceries", "milk eggs");
    await createNoteFor(cookie, "ideas", "rocket boots");
    await createNoteFor(cookie, "more groceries", "bread");

    const res = await fetch("http://localhost:3000/?q=groc", {
      headers: { cookie },
    });
    const html = await res.text();
    expect(html).toContain("groceries");
    expect(html).toContain("more groceries");
    expect(html).not.toContain("ideas");
  });

  test("search filters notes by a substring in the body", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    await createNoteFor(cookie, "first", "rocket boots");
    await createNoteFor(cookie, "second", "ordinary boots");
    await createNoteFor(cookie, "third", "no footwear");

    const res = await fetch("http://localhost:3000/?q=boots", {
      headers: { cookie },
    });
    const html = await res.text();
    expect(html).toContain("first");
    expect(html).toContain("second");
    expect(html).not.toContain("third");
  });

  test("search with no matches renders a friendly empty message", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    await createNoteFor(cookie, "real note", "real body");

    const res = await fetch("http://localhost:3000/?q=nothing", {
      headers: { cookie },
    });
    const html = await res.text();
    expect(html).toContain("No notes match");
    expect(html).toContain("nothing");
    expect(html).not.toContain("real note");
  });

  test("search query is HTML-escaped in the input and the empty message", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");

    const res = await fetch(
      "http://localhost:3000/?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E",
      { headers: { cookie } },
    );
    const html = await res.text();
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("only the current user's notes appear in search results", async () => {
    const aliceCookie = await loginAs("alice@example.com", "longenough");
    await createNoteFor(aliceCookie, "alice-secret", "private");

    const bobCookie = await loginAs("bob@example.com", "longenough");
    await createNoteFor(bobCookie, "bob-note", "secret");

    const res = await fetch("http://localhost:3000/?q=secret", {
      headers: { cookie: bobCookie },
    });
    const html = await res.text();
    expect(html).toContain("bob-note");
    expect(html).not.toContain("alice-secret");
  });

  test("the page caps the list at ten notes", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    for (let i = 1; i <= 12; i++) {
      await createNoteFor(cookie, `note-${i}`, "x");
    }

    const res = await fetch("http://localhost:3000/", { headers: { cookie } });
    const html = await res.text();
    const matches = html.match(/<li>/g) ?? [];
    expect(matches.length).toBe(10);
    expect(html).toContain("Page 1 of 2");
  });

  test("page=2 shows the next ten notes", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    for (let i = 1; i <= 12; i++) {
      await createNoteFor(cookie, `note-${i}`, "x");
    }

    const res = await fetch("http://localhost:3000/?page=2", {
      headers: { cookie },
    });
    const html = await res.text();
    expect(html).toContain("note-1");
    expect(html).toContain("note-2");
    expect(html).not.toContain("note-12");
    expect(html).toContain("Page 2 of 2");
  });

  test("the pager does not render when everything fits on one page", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    await createNoteFor(cookie, "only one", "x");

    const res = await fetch("http://localhost:3000/", { headers: { cookie } });
    const html = await res.text();
    expect(html).not.toContain("Page 1 of");
    expect(html).not.toContain('class="pager"');
  });

  test("search and pagination work together", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    for (let i = 1; i <= 12; i++) {
      await createNoteFor(cookie, `match-${i}`, "x");
    }
    await createNoteFor(cookie, "no-match", "y");

    const page1 = await fetch("http://localhost:3000/?q=match", {
      headers: { cookie },
    });
    const html1 = await page1.text();
    expect(html1).toContain("Page 1 of 2");
    expect(html1).toContain('href="/?q=match&amp;page=2"');
    expect(html1).not.toContain("no-match");

    const page2 = await fetch("http://localhost:3000/?q=match&page=2", {
      headers: { cookie },
    });
    const html2 = await page2.text();
    expect(html2).toContain("Page 2 of 2");
    expect(html2).toContain("match-1");
  });

  test("?page=0 and a garbage page value both fall back to page 1", async () => {
    const cookie = await loginAs("alice@example.com", "longenough");
    for (let i = 1; i <= 12; i++) {
      await createNoteFor(cookie, `note-${i}`, "x");
    }

    const zero = await fetch("http://localhost:3000/?page=0", {
      headers: { cookie },
    });
    expect(await zero.text()).toContain("Page 1 of 2");

    const junk = await fetch("http://localhost:3000/?page=banana", {
      headers: { cookie },
    });
    expect(await junk.text()).toContain("Page 1 of 2");
  });
});
