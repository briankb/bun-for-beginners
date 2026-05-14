// templates.test.ts
import { test, expect } from "bun:test";
import { escapeHtml, renderForm, renderNav, renderPager } from "./templates";

test("escapeHtml escapes the five HTML special characters", () => {
  expect(escapeHtml("<")).toBe("&lt;");
  expect(escapeHtml(">")).toBe("&gt;");
  expect(escapeHtml("&")).toBe("&amp;");
  expect(escapeHtml('"')).toBe("&quot;");
  expect(escapeHtml("'")).toBe("&#39;");
});

test("escapeHtml leaves safe text alone", () => {
  expect(escapeHtml("hello world")).toBe("hello world");
  expect(escapeHtml("")).toBe("");
});

test("renderForm shows empty fields by default", () => {
  const html = renderForm();
  expect(html).toContain('value=""');
  expect(html).toContain("<textarea");
  expect(html).not.toContain('class="errors"');
});

test("renderForm round-trips user input safely", () => {
  const html = renderForm({ title: "<x>", body: "&amp;" });
  expect(html).toContain('value="&lt;x&gt;"');
  expect(html).toContain("&amp;amp;");
  expect(html).not.toContain("<x>");
});

test("renderForm shows the error list when given errors", () => {
  const html = renderForm({ title: "", body: "" }, ["Title is required."]);
  expect(html).toContain('class="errors"');
  expect(html).toContain("Title is required.");
});

test("renderNav shows logged-in links when given a user", () => {
  const html = renderNav({
    id: 1,
    email: "a@b.com",
    password_hash: "",
    created_at: 0,
    updated_at: 0,
  });
  expect(html).toContain('href="/notes/new"');
  expect(html).toContain('action="/logout"');
  expect(html).not.toContain('href="/login"');
});

test("renderNav shows logged-out links when given null", () => {
  const html = renderNav(null);
  expect(html).toContain('href="/signup"');
  expect(html).toContain('href="/login"');
  expect(html).not.toContain('href="/notes/new"');
});

test("renderPager returns empty string when there is one page or fewer", () => {
  expect(renderPager(1, 1, "")).toBe("");
  expect(renderPager(1, 0, "")).toBe("");
});

test("renderPager links forward when there is a next page", () => {
  const html = renderPager(1, 3, "");
  expect(html).toContain('href="/?page=2"');
  expect(html).toContain("Page 1 of 3");
});

test("renderPager links back when there is a previous page", () => {
  const html = renderPager(2, 3, "");
  expect(html).toContain('href="/"');
  expect(html).toContain('href="/?page=3"');
});

test("renderPager disables prev on the first page and next on the last", () => {
  const first = renderPager(1, 3, "");
  expect(first).toContain('class="prev disabled"');
  expect(first).not.toContain('class="next disabled"');

  const last = renderPager(3, 3, "");
  expect(last).toContain('class="next disabled"');
  expect(last).not.toContain('class="prev disabled"');
});

test("renderPager carries the search query in pager links", () => {
  const html = renderPager(1, 3, "groceries");
  expect(html).toContain("q=groceries");
  expect(html).toContain("page=2");
});
