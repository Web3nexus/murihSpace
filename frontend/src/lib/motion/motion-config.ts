import { standardTransition } from "./transitions";

export const globalMotionConfig = {
  reducedMotion: "user" as const,
  transition: standardTransition,
};
