/**
* Header Component
* Top navigation bar matching the sidebar aesthetic.
*/
"use client";
import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export function Header() {
  return (
    <header className="h-16 shrink-0 border-b border-violet-500/20 bg-transparent backdrop-blur-sm flex items-center px-6">
      <div className="flex items-center gap-3">
        <motion.div
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400 cursor-pointer hover:bg-violet-500/20 transition-colors"
        >
          <Sparkles className="h-5 w-5" />
        </motion.div>
        {/* Placeholder for future search or title */}
      </div>
    </header>
  );
}
