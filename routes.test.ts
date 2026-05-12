// routes.test.ts
import { test, expect } from "bun:test";
import { validateNote } from "./routes";

test("validateNote accepts a normal note", () => {
  expect(validateNote("Buy milk", "Two percent")).toEqual([]);
});

test("validateNote rejects an empty title", () => {
  const errors = validateNote("", "body");
  expect(errors).toContain("Title is required.");
});

test("validateNote rejects whitespace-only title", () => {
  const errors = validateNote("   ", "body");
  expect(errors).toContain("Title is required.");
});

test("validateNote rejects an empty body", () => {
  const errors = validateNote("title", "");
  expect(errors).toContain("Body is required.");
});

test("validateNote rejects a title over 200 characters", () => {
  const errors = validateNote("a".repeat(201), "body");
  expect(errors).toContain("Title must be 200 characters or less.");
});

test("validateNote returns multiple errors at once", () => {
  const errors = validateNote("", "");
  expect(errors.length).toBe(2);
});
