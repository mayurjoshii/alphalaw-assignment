/**
 * Animated number. On the resolved-policy panel it signals that the total is
 * *computed* -- it visibly moves when you change an attribute, rather than
 * silently swapping to a new digit.
 */

import { animate, useMotionValue, useTransform, motion } from 'motion/react';
import { useEffect } from 'react';

export function CountUp({ value, className }: { value: number; className?: string }) {
  const motionValue = useMotionValue(value);
  const rounded = useTransform(motionValue, (latest) => Math.round(latest).toString());

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1],
    });
    return () => controls.stop();
  }, [motionValue, value]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
