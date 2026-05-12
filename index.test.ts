// index.test.ts
import { describe, expect, test, beforeEach } from "bun:test";
import "./index.ts";
import { db } from "./db";

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
