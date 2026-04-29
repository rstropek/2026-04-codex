import { math } from "@questionnaires/lib";
import { describe, expect, it } from "vitest";

describe("math.add", () => {
  it("adds numbers from the shared library", () => {
    expect(math.add(1, 2)).toBe(3);
  });
});
