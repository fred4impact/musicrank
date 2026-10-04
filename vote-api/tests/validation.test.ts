import { describe, expect, it } from "vitest";
import { voteRequestSchema } from "../src/validation.js";

const validUserId = "11111111-1111-1111-1111-111111111111";

describe("voteRequestSchema", () => {
  it("accepts a well-formed vote request", () => {
    const result = voteRequestSchema.safeParse({ songId: 1, rating: 5, userId: validUserId });
    expect(result.success).toBe(true);
  });

  it.each([0, 6, -1, 1.5])("rejects an out-of-range or non-integer rating (%s)", (rating) => {
    const result = voteRequestSchema.safeParse({ songId: 1, rating, userId: validUserId });
    expect(result.success).toBe(false);
  });

  it.each([0, -5, 1.5])("rejects an invalid songId (%s)", (songId) => {
    const result = voteRequestSchema.safeParse({ songId, rating: 5, userId: validUserId });
    expect(result.success).toBe(false);
  });

  it("rejects a non-UUID userId", () => {
    const result = voteRequestSchema.safeParse({ songId: 1, rating: 5, userId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing field", () => {
    const result = voteRequestSchema.safeParse({ songId: 1, rating: 5 });
    expect(result.success).toBe(false);
  });
});
