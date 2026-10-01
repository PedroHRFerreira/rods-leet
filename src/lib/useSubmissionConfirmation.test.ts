import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  readSubmissionConfirmation,
  resetSubmissionConfirmations,
  writeSubmissionConfirmation,
} from "./useSubmissionConfirmation";

describe("submission confirmation preferences", () => {
  let stored: Map<string, string>;
  beforeEach(() => {
    stored = new Map();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => stored.set(key, value),
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  test("starts with confirmation and separates accounts and submission kinds", () => {
    expect(readSubmissionConfirmation("account-a", "quiz")).toBe(false);
    writeSubmissionConfirmation("account-a", "quiz", true);
    expect(readSubmissionConfirmation("account-a", "quiz")).toBe(true);
    expect(readSubmissionConfirmation("account-a", "code")).toBe(false);
    expect(readSubmissionConfirmation("account-b", "quiz")).toBe(false);
    expect([...stored.keys()][0]).toBe(
      "rods-leet:submission-confirmation:v1:account-a:quiz",
    );
  });

  test("reset re-enables both kinds without changing another account", () => {
    writeSubmissionConfirmation("reset-user", "quiz", true);
    writeSubmissionConfirmation("reset-user", "code", true);
    writeSubmissionConfirmation("other-user", "quiz", true);
    resetSubmissionConfirmations("reset-user");
    expect(readSubmissionConfirmation("reset-user", "quiz")).toBe(false);
    expect(readSubmissionConfirmation("reset-user", "code")).toBe(false);
    expect(readSubmissionConfirmation("other-user", "quiz")).toBe(true);
  });

  test("unrecognized persisted values do not disable confirmation", () => {
    writeSubmissionConfirmation("corrupted", "quiz", true);
    stored.set([...stored.keys()][0], "invalid");
    expect(readSubmissionConfirmation("corrupted", "quiz")).toBe(false);
  });

  test("remains usable when both storage reads and writes fail", () => {
    vi.stubGlobal("window", {
      get localStorage() {
        throw new Error("Unavailable");
      },
    });
    expect(readSubmissionConfirmation("private-user", "quiz")).toBe(false);
    writeSubmissionConfirmation("private-user", "quiz", true);
    expect(readSubmissionConfirmation("private-user", "quiz")).toBe(true);
    resetSubmissionConfirmations("private-user");
    expect(readSubmissionConfirmation("private-user", "quiz")).toBe(false);
  });

  test("preserves the session choice when storage is readable but writes fail", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("Quota exceeded");
        },
      },
    });
    writeSubmissionConfirmation("quota-user", "code", true);
    expect(readSubmissionConfirmation("quota-user", "code")).toBe(true);
    writeSubmissionConfirmation("quota-user", "code", false);
    expect(readSubmissionConfirmation("quota-user", "code")).toBe(false);
  });

  test("encodes identity delimiters to avoid key collisions", () => {
    writeSubmissionConfirmation("a:quiz", "code", true);
    expect([...stored.keys()][0]).toContain("a%3Aquiz:code");
    expect(readSubmissionConfirmation("a", "quiz")).toBe(false);
  });
});
