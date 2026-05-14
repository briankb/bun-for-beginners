// wordcount.test.ts
import { describe, test, expect } from "bun:test";
import { countWords } from "./wordcount.ts";

describe("countWords", () => {
  test("counts two words", () => {
    expect(countWords("hello world")).toBe(2);
  });

  test("returns zero for an empty string", () => {
    expect(countWords("")).toBe(0);
  });

  test("counts a single word", () => {
    expect(countWords("hello")).toBe(1);
  });

  test("handles multiple spaces between words", () => {
    expect(countWords("hello    world")).toBe(2);
  });

  test("ignores leading and trailing whitespace", () => {
    expect(countWords("  hello world  ")).toBe(2);
  });

  test("handles tabs and newlines", () => {
    expect(countWords("hello\tworld\nfoo")).toBe(3);
  });
});
