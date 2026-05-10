// index.test.ts
import { describe, test, expect } from "bun:test";
import "./index.ts";

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
  });

  test("health check returns OK", async () => {
    const res = await fetch("http://localhost:3000/ok");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  test("wildcard route serves the stylesheet", async () => {
    const res = await fetch("http://localhost:3000/style.css");
    expect(res.status).toBe(200);
  });

  test("unknown URL returns 404", async () => {
    const res = await fetch("http://localhost:3000/nope");
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Page not found");
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
    form.set("title", "redirect-test-note");
    form.set("body", "checking the redirect");

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
    form.set("title", "buy-milk-test-note");
    form.set("body", "two percent please");

    await fetch("http://localhost:3000/notes", {
      method: "POST",
      body: form,
      redirect: "manual",
    });

    const res = await fetch("http://localhost:3000/");
    const html = await res.text();
    expect(html).toContain("buy-milk-test-note");
    expect(html).toContain("two percent please");
  });

  test("user input is escaped on the home page", async () => {
    const form = new FormData();
    form.set("title", "<script>alert('xss')</script>");
    form.set("body", "escape-test-body");

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
});
