import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { fadeVariants, slideVariants, scaleVariants } from "@/lib/motion/transitions";

export function AnimationVerify() {
  const [showFade, setShowFade] = useState(true);
  const [showSlide, setShowSlide] = useState(true);
  const [showScale, setShowScale] = useState(true);

  return (
    <div className="p-6 border border-gray-200 dark:border-gray-800 rounded-lg max-w-2xl mx-auto my-8 space-y-8 bg-card text-card-foreground shadow-sm">
      <h2 className="text-xl font-bold border-b pb-2">Motion Animation Verification</h2>
      
      {/* Fade section */}
      <div className="space-y-2 text-left">
        <h3 className="text-sm font-semibold text-muted-foreground">1. Fade Animation</h3>
        <button 
          type="button"
          onClick={() => setShowFade(!showFade)}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
        >
          Toggle Fade
        </button>
        <div className="h-16 flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-700 rounded">
          <AnimatePresence mode="wait">
            {showFade && (
              <motion.div
                variants={fadeVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="p-2 bg-green-500/20 text-green-700 dark:text-green-300 rounded font-medium"
              >
                Fading Box
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Slide section */}
      <div className="space-y-2 text-left">
        <h3 className="text-sm font-semibold text-muted-foreground">2. Slide Animation</h3>
        <button 
          type="button"
          onClick={() => setShowSlide(!showSlide)}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
        >
          Toggle Slide
        </button>
        <div className="h-16 flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-700 rounded overflow-hidden">
          <AnimatePresence mode="wait">
            {showSlide && (
              <motion.div
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="p-2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded font-medium"
              >
                Sliding Box
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Scale section */}
      <div className="space-y-2 text-left">
        <h3 className="text-sm font-semibold text-muted-foreground">3. Scale Animation</h3>
        <button 
          type="button"
          onClick={() => setShowScale(!showScale)}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
        >
          Toggle Scale
        </button>
        <div className="h-16 flex items-center justify-center border border-dashed border-gray-300 dark:border-gray-700 rounded">
          <AnimatePresence mode="wait">
            {showScale && (
              <motion.div
                variants={scaleVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="p-2 bg-purple-500/20 text-purple-700 dark:text-purple-300 rounded font-medium"
              >
                Scaling Box
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Info section for reduced motion */}
      <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs space-y-1 text-left">
        <p className="font-semibold text-gray-700 dark:text-gray-300">Reduced Motion Compatibility:</p>
        <p className="text-gray-600 dark:text-gray-400">
          This panel respects standard OS preferences via the <code>reducedMotion="user"</code> global configuration in <code>MotionProvider</code>.
        </p>
      </div>
    </div>
  );
}
