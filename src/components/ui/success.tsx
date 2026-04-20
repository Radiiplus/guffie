/**
 * Success Modal Component
 * Displays the generated Private Key (PK) after successful registration.
 * Forces user to acknowledge they have saved it before proceeding.
 */
"use client";

import { useState } from "react";
import { CheckCircle2, Copy, ShieldAlert, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface SuccessModalProps {
  isOpen: boolean;
  pk: string;
  username: string;
  onConfirm: () => void;
}

export function SuccessModal({
  isOpen,
  pk,
  username,
  onConfirm,
}: SuccessModalProps) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pk);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="relative w-full max-w-lg rounded-3xl border border-violet-500/30 bg-zinc-950 shadow-[0_0_30px_-5px_rgba(139,92,246,0.3)] p-6 sm:p-8"
          >
            {/* Header */}
            <div className="flex flex-col items-center text-center mb-6">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Account Created!
              </h2>
              <p className="mt-2 text-sm text-zinc-400 max-w-xs">
                Welcome,{" "}
                <span className="text-violet-400 font-medium">@{username}</span>
                . Please save your Private Key immediately.
              </p>
            </div>

            {/* Warning Box */}
            <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex gap-3 items-start">
              <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-left">
                <p className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-1">
                  Critical Security Step
                </p>
                <p className="text-xs text-amber-200/80 leading-relaxed">
                  This key is the only way to recover your account.
                  <strong> We do not store it.</strong> If you lose it, your
                  account is lost forever.
                </p>
              </div>
            </div>

            {/* PK Display Card */}
            <div className="mb-6 relative group">
              <div className="absolute -inset-0.5 bg-linear-to-r from-violet-500 to-fuchsia-500 rounded-xl opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
              <div className="relative flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <code className="font-mono text-sm text-violet-300 break-all mr-2 select-all">
                  {pk}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopy}
                  className="shrink-0 h-9 w-9 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {copied && (
                <motion.p
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute -bottom-6 left-0 right-0 text-center text-xs text-green-400 font-medium"
                >
                  Copied to clipboard!
                </motion.p>
              )}
            </div>

            {/* Confirmation Action */}
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-zinc-900/50 transition-colors">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="h-5 w-5 rounded border-zinc-700 bg-zinc-900 text-violet-500 focus:ring-violet-500/50 accent-violet-500 cursor-pointer"
                />
                <span
                  className={`text-sm font-medium transition-colors ${acknowledged ? "text-white" : "text-zinc-500"}`}
                >
                  I have securely saved my Private Key
                </span>
              </label>

              <Button
                onClick={onConfirm}
                disabled={!acknowledged}
                className="w-full h-12 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                Continue to Login
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
