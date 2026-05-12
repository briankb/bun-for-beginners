// users.test.ts
import { test, expect } from "bun:test";
import { validateSignup } from "./users";

test("validateSignup accepts valid input", () => {
  expect(validateSignup("a@b.com", "longenough", "longenough")).toEqual([]);
});

test("validateSignup rejects empty email", () => {
  const errors = validateSignup("", "longenough", "longenough");
  expect(errors).toContain("Email is required.");
});

test("validateSignup rejects email without an @", () => {
  const errors = validateSignup("notanemail", "longenough", "longenough");
  expect(errors).toContain("Email must contain an @.");
});

test("validateSignup rejects a password shorter than 8 characters", () => {
  const errors = validateSignup("a@b.com", "short", "short");
  expect(errors).toContain("Password must be at least 8 characters.");
});

test("validateSignup rejects mismatched passwords", () => {
  const errors = validateSignup("a@b.com", "longenough", "different");
  expect(errors).toContain("Passwords do not match.");
});
