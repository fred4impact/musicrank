import { z } from "zod";

// Structural validation only — the vote API never queries Postgres (see spec
// §6: HTTP Request -> Validate -> Create Event -> Redis -> Return response).
// Whether the song/user actually exist is the worker's problem to catch.
export const voteRequestSchema = z.object({
  songId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  userId: z.string().uuid(),
});

export type VoteRequest = z.infer<typeof voteRequestSchema>;
