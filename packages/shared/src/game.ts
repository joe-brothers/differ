import { z } from "zod";

export const RectArea = z.object({
  id: z.string(),
  sp: z.object({ x: z.number(), y: z.number() }),
  w: z.number(),
  h: z.number(),
});
export type RectArea = z.infer<typeof RectArea>;

export const Puzzle = z.object({
  id: z.string(),
  path: z.string(),
  extension: z.string(),
  differences: z.array(RectArea),
});
export type Puzzle = z.infer<typeof Puzzle>;

export const GameMode = z.enum(["single", "1v1"]);
export type GameMode = z.infer<typeof GameMode>;

export const PUZZLES_PER_GAME = 5;
export const DIFFS_PER_PUZZLE = 5;
export const PUZZLE_CANDIDATE_COUNT = 10;

export const CANVAS_WIDTH = 300;
export const CANVAS_HEIGHT = 430;
