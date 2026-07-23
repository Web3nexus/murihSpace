import type { Transition } from "motion/react";

// Restrained reusable transition configurations
export const quickTransition: Transition = {
  duration: 0.15,
  ease: "easeOut",
};

export const standardTransition: Transition = {
  duration: 0.3,
  ease: [0.25, 0.1, 0.25, 1.0], // cubic-bezier(0.25, 0.1, 0.25, 1)
};

export const deliberateTransition: Transition = {
  duration: 0.5,
  ease: [0.25, 0.1, 0.25, 1.0],
};

export const springTransition: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

export const panelTransition: Transition = {
  type: "spring",
  stiffness: 380,
  damping: 40,
};

// Reusable animation variants
export const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const slideVariants = {
  initial: { y: 20, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: -20, opacity: 0 },
};

export const scaleVariants = {
  initial: { scale: 0.95, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  exit: { scale: 0.95, opacity: 0 },
};
