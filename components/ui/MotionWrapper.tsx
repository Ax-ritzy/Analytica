"use client";

import { motion, AnimatePresence, HTMLMotionProps } from "motion/react";
import React from "react";

export { motion, AnimatePresence };

interface TransitionProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

export function FadeIn({ children, delay = 0, duration = 0.35, className = "", ...props }: TransitionProps) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`animate-in fade-in duration-300 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function SlideUp({ children, delay = 0, duration = 0.45, className = "", ...props }: TransitionProps) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`animate-in fade-in slide-in-from-bottom-2 duration-300 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function ScaleIn({ children, delay = 0, duration = 0.3, className = "", ...props }: TransitionProps) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration, delay, ease: [0.16, 1, 0.3, 1] }}
      className={`animate-in fade-in zoom-in-95 duration-200 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerContainer({
  children,
  staggerDelay = 0.08,
  delayChildren = 0,
  className = "",
  ...props
}: {
  children: React.ReactNode;
  staggerDelay?: number;
  delayChildren?: number;
  className?: string;
} & HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={false}
      animate="visible"
      exit="hidden"
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: staggerDelay,
            delayChildren,
          },
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = "",
  ...props
}: {
  children: React.ReactNode;
  className?: string;
} & HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={false}
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
        },
      }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
