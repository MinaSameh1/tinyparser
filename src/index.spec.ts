import assert from "node:assert";
import { it, describe } from "node:test";

// Make sure test runner is working
describe("should return 4", () => {
  it("should return 4", () => {
    assert(2 + 2 === 4, "2 + 2 should be 4");
  });
});
