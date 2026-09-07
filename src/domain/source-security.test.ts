import { expect, it } from "vitest";
import {
  hasUnsafeSourceCharacters,
  isClipboardShortcut,
} from "./source-security";

it("rejects invisible controls that can disguise source code", () => {
  expect(hasUnsafeSourceCharacters("const role = 'user';")).toBe(false);
  expect(hasUnsafeSourceCharacters("const safe = true;\u202E // hidden")).toBe(
    true,
  );
  expect(hasUnsafeSourceCharacters("let\u200bvalue = 1;")).toBe(true);
  expect(
    hasUnsafeSourceCharacters(`let x = 1;${String.fromCodePoint(0x61c)}`),
  ).toBe(true);
  expect(
    hasUnsafeSourceCharacters(`let x = 1;${String.fromCodePoint(0x1b)}`),
  ).toBe(true);
  expect(hasUnsafeSourceCharacters("const\n\tvalue = 1;")).toBe(false);
});

it("identifies copy, cut and paste keyboard shortcuts", () => {
  for (const key of ["c", "v", "x", "C", "V", "X"])
    expect(isClipboardShortcut({ key, ctrlKey: true, metaKey: false })).toBe(
      true,
    );
  expect(isClipboardShortcut({ key: "z", ctrlKey: true, metaKey: false })).toBe(
    false,
  );
  expect(
    isClipboardShortcut({ key: "c", ctrlKey: false, metaKey: false }),
  ).toBe(false);
});
