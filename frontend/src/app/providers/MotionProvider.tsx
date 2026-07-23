import { MotionConfig } from "motion/react";
import { globalMotionConfig } from "@/lib/motion/motion-config";

interface MotionProviderProps {
  children: React.ReactNode;
}

export function MotionProvider({ children }: MotionProviderProps) {
  return (
    <MotionConfig {...globalMotionConfig}>
      {children}
    </MotionConfig>
  );
}
