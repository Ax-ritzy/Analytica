"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { motion } from "motion/react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = localStorage.getItem("faw-theme") as "dark" | "light" | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.classList.toggle("light", saved === "light");
    } else {
      document.documentElement.classList.remove("light");
    }
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("faw-theme", next);
    document.documentElement.classList.toggle("light", next === "light");
  }

  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={toggleTheme}
      title={`Switch to ${theme === "dark" ? "Light" : "Dark"} mode`}
      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 transition-colors"
      aria-label="Toggle theme"
    >
      <motion.div
        key={theme}
        initial={false}
        animate={{ rotate: 0, opacity: 1 }}
        exit={{ rotate: 45, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {theme === "dark" ? (
          <Sun size={15} className="text-amber-300" />
        ) : (
          <Moon size={15} className="text-blue-500" />
        )}
      </motion.div>
    </motion.button>
  );
}
