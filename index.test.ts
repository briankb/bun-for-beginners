// index.test.ts
import { describe, expect, test, beforeEach } from "bun:test";
import "./index.ts";
import { db } from "./db";

beforeEach(() => {
  db.run("DELETE FROM notes");
  db.run("DELETE FROM users");
});

describe("server routes", () => {
  test("home page returns 200 with welcome text", async () => {
    const res = await fetch("http://localhost:3000/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Notes");
  });

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

  test("unknown URL returns 404", async () => {
    const res = await fetch("http://localhost:3000/nope");
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain("Not found");
    expect(html).toContain('<a href="/">Go home</a>');
  });
});

describe("notes", () => {
  test("GET /notes/new returns the form", async () => {
    const res = await fetch("http://localhost:3000/notes/new");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<form method="POST" action="/notes">');
  });

  test("POST /notes redirects to home", async () => {
    const form = new FormData();
    form.set("title", "buy milk");
    form.set("body", "two percent please");

    const res = await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      redirect: "manual",
    });

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");
  });

  test("submitted notes appear on the home page", async () => {
    const form = new FormData();
    form.set("title", "buy milk");
    form.set("body", "two percent please");

    await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      redirect: "manual",
    });

    const res = await fetch("http://localhost:3000/");
    const html = await res.text();
    expect(html).toContain("buy milk");
    expect(html).toContain("two percent please");
  });

  test("user input is escaped on the home page", async () => {
    const form = new FormData();
    form.set("title", "<script>alert('xss')</script>");
    form.set("body", "ok");

    await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      redirect: "manual",
    });

    const res = await fetch("http://localhost:3000/");
    const html = await res.text();
    expect(html).not.toContain("<script>alert('xss')</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("multiple notes appear in order", async () => {
    const form = new FormData();
    form.set("title", "first");
    form.set("body", "one");

    await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      redirect: "manual",
    });

    form.set("title", "second");
    form.set("body", "two");

    await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      redirect: "manual",
    });

    const res = await fetch("http://localhost:3000/");
    const html = await res.text();
    expect(html).toContain("first");
    expect(html).toContain("second");
  });
});

describe("validation and errors", () => {
  test("empty title returns the form with an error", async () => {
    const form = new FormData();
    form.set("title", "");
    form.set("body", "has a body");

    const res = await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      redirect: "manual",
    });

    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain("Title is required.");
  });

  test("empty body returns the form with an error", async () => {
    const form = new FormData();
    form.set("title", "has a title");
    form.set("body", "");

    const res = await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      redirect: "manual",
    });

    expect(res.status).toBe(422);
    const html = await res.text();
    expect(html).toContain("Body is required.");
  });

  test("invalid form preserves the user's input", async () => {
    const form = new FormData();
    form.set("title", "kept around");
    form.set("body", "");

    const res = await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      redirect: "manual",
    });

    const html = await res.text();
    expect(html).toContain('value="kept around"');
  });

  test("invalid form does not write to the database", async () => {
    const form = new FormData();
    form.set("title", "");
    form.set("body", "");

    await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      redirect: "manual",
    });

    const res = await fetch("http://localhost:3000/");
    const html = await res.text();
    expect(html).toContain("No notes yet.");
  });

  test("missing route returns the styled 404 page", async () => {
    const res = await fetch("http://localhost:3000/no-such-page");
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain("<nav>");
    expect(html).toContain("Not found");
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
