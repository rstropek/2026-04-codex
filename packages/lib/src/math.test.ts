import { describe, expect, it } from "vitest";

import { add } from "./math";

describe("add", () => {
  it("returns the sum of two numbers", () => {
    expect(add(1, 2)).toBe(3);
  });
});
