/**
 * Legal Modal Component
 * A reusable modal for displaying Terms of Service and Privacy Policy.
 * Fetches content from external configuration and handles user acceptance.
 */
"use client";

import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEGAL_CONTENT } from "@/lib/legal";

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "terms" | "privacy";
  onAccept: () => void;
  isAccepted: boolean;
  setAccepted: (val: boolean) => void;
  isLoading?: boolean;
}

export function LegalModal({
  isOpen,
  onClose,
  type,
  onAccept,
  isAccepted,
  setAccepted,
  isLoading = false,
}: LegalModalProps) {
  if (!isOpen) return null;

  const content = LEGAL_CONTENT[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">{content.title}</h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors p-1 hover:bg-zinc-800 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="max-h-[50vh] overflow-y-auto text-sm text-zinc-300 space-y-4 pr-2 leading-relaxed [&>p]:mb-4"
          dangerouslySetInnerHTML={{ __html: content.body }}
        />

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-zinc-800">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="modal-accept"
              checked={isAccepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-white focus:ring-zinc-700 accent-violet-500"
            />
            <label
              htmlFor="modal-accept"
              className="text-sm text-zinc-400 cursor-pointer select-none"
            >
              I agree to the {type === "terms" ? "Terms" : "Policy"}
            </label>
          </div>

          <Button
            onClick={onAccept}
            disabled={!isAccepted || isLoading}
            className="bg-white text-black hover:bg-zinc-200 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Accept & Continue"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
