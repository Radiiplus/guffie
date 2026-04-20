/**
 * Combined legal acceptance modal.
 * Matches the registration flow where both terms and privacy must be accepted together.
 */
"use client";

import { X, Loader2, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  setAcceptedTerms: (val: boolean) => void;
  setAcceptedPrivacy: (val: boolean) => void;
  isLoading?: boolean;
}

export function LegalModal({
  isOpen,
  onClose,
  onAccept,
  acceptedTerms,
  acceptedPrivacy,
  setAcceptedTerms,
  setAcceptedPrivacy,
  isLoading = false,
}: LegalModalProps) {
  if (!isOpen) return null;

  const bothAccepted = acceptedTerms && acceptedPrivacy;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Terms & Privacy</h3>
          <p className="mt-1 text-xs text-zinc-400">Please review and accept both policies.</p>
        </div>

        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4 max-h-56 space-y-4 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 text-xs text-zinc-300">
          <div>
            <h4 className="mb-1 text-sm font-semibold text-white">Terms of Service</h4>
            <p>
              Using Guffie means you accept platform rules, keep your account and recovery key secure,
              and take responsibility for what you post. Content ownership stays with you, but you grant
              Guffie permission to display it on the platform.
            </p>
            <p className="mt-1">
              Illegal, abusive, spammy, impersonation, and unauthorized-access behavior is prohibited,
              including abuse of anonymous posting. Violations can lead to moderation, suspension, or removal.
            </p>
            <Link to="/terms" className="mt-1 inline-block text-violet-400 hover:text-violet-300">
              Read full Terms of Service
            </Link>
          </div>
          <div className="border-t border-zinc-800 pt-4">
            <h4 className="mb-1 text-sm font-semibold text-white">Privacy Policy</h4>
            <p>
              We collect account, profile, content, interaction, and technical data to operate the app,
              secure sessions, power chat and notifications, improve performance, and enforce safety rules.
            </p>
            <p className="mt-1">
              Anonymous posts hide identity from other users, and internal safety controls still apply.
              We do not sell personal data; sharing is limited to operations, legal obligations, and transfers when required.
            </p>
            <Link to="/privacy" className="mt-1 inline-block text-violet-400 hover:text-violet-300">
              Read full Privacy Policy
            </Link>
          </div>
        </div>

        <div className="mb-5 space-y-3">
          <label className="flex cursor-pointer items-start gap-3 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-violet-500"
            />
            <span>
              I agree to the <Link to="/terms" className="text-violet-400 hover:text-violet-300">Terms of Service</Link>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={acceptedPrivacy}
              onChange={(e) => setAcceptedPrivacy(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-violet-500"
            />
            <span>
              I agree to the <Link to="/privacy" className="text-violet-400 hover:text-violet-300">Privacy Policy</Link>
            </span>
          </label>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            onClick={onClose}
            className="flex-1 border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={onAccept}
            disabled={!bothAccepted || isLoading}
            className="flex-1 bg-violet-500 text-black hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-violet-500/30 disabled:text-zinc-500"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept & Register"}
          </Button>
        </div>
      </div>
    </div>
  );
}
