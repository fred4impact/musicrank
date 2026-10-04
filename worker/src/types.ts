import { z } from "zod";

// Mirrors vote-api's VoteEvent shape (spec §7) — kept as a separate copy
// rather than a shared package, since these are two independently
// deployable services per spec §15.
export const voteEventSchema = z.object({
  eventId: z.string().min(1),
  userId: z.string().uuid(),
  songId: z.number().int().positive(),
  rating: z.number().int().min(1).max(5),
  timestamp: z.string().datetime(),
});

export type VoteEvent = z.infer<typeof voteEventSchema>;
