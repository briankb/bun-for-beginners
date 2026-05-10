// index.test.ts
import { describe, test, expect } from "bun:test";
import "./index.ts";

describe("server routes", () => {
  test("home page returns 200 with welcome text", async () => {
    const res = await fetch("http://localhost:3000/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Welcome");
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
