/**
 * Interactive Inputs Module
 * Updated to support real-time validation states (loading/success).
 */
"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";

interface InputGroupProps extends React.ComponentProps<typeof Input> {
  icon: React.ReactNode;
  placeholder: string;
  error?: string;
  // New props for real-time validation
  status?: "idle" | "loading" | "success" | "error";
}

export function InputGroup({
  icon,
  placeholder,
  error,
  status = "idle",
  ...props
}: InputGroupProps) {
  // Determine the right-side icon based on status
  let StatusIcon = null;
  if (status === "loading") {
    StatusIcon = <Loader2 className="h-4 w-4 animate-spin text-violet-400" />;
  } else if (status === "success") {
    StatusIcon = <CheckCircle2 className="h-4 w-4 text-green-400" />;
  } else if (status === "error" || error) {
    StatusIcon = <AlertCircle className="h-4 w-4 text-red-400" />;
  }

  return (
    <div className="group relative">
      <Input
        placeholder={placeholder}
        className={`h-11 w-full rounded-xl border bg-zinc-900/50 pl-10 pr-10 text-sm font-medium text-white placeholder:text-zinc-600 transition-all duration-300 focus:bg-zinc-900 focus-visible:ring-0 hover:border-zinc-700 ${
          error
            ? "border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
            : status === "success"
            ? "border-green-500/50 focus:border-green-500 focus:ring-1 focus:ring-green-500/50"
            : "border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
        }`}
        {...props}
      />
      
      {/* Left Icon */}
      <div className="absolute left-3 top-3.5 h-4 w-4 flex items-center justify-center text-zinc-500 transition-colors duration-300 group-focus-within:text-violet-400 group-hover:text-zinc-400">
        {icon}
      </div>

      {/* Right Status Icon */}
      {StatusIcon && (
        <div className="absolute right-3 top-3.5 h-4 w-4 flex items-center justify-center">
          {StatusIcon}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="mt-1 text-xs text-red-500 pl-1 animate-in slide-in-from-top-1">
          {error}
        </p>
      )}
      
      {/* Success/Info Message (Optional, can be added if needed) */}
      {!error && status === "success" && (
        <p className="mt-1 text-xs text-green-500 pl-1 animate-in slide-in-from-top-1">
          Username is available
        </p>
      )}
       {!error && status === "loading" && (
        <p className="mt-1 text-xs text-zinc-500 pl-1 animate-in slide-in-from-top-1">
          Checking availability...
        </p>
      )}
    </div>
  );
}

interface PasswordInputProps {
  id: string;
  placeholder: string;
  show: boolean;
  onToggle: () => void;
  error?: string;
  register: UseFormRegisterReturn;
  isLoading: boolean;
}

export function PasswordInput({
  id,
  placeholder,
  show,
  onToggle,
  error,
  register,
  isLoading,
}: PasswordInputProps) {
  return (
    <div className="group relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        disabled={isLoading}
        className={`h-11 w-full rounded-xl border bg-zinc-900/50 pl-10 pr-10 text-sm font-medium text-white placeholder:text-zinc-600 transition-all duration-300 focus:bg-zinc-900 focus-visible:ring-0 hover:border-zinc-700 ${
          error
            ? "border-red-500/50 focus:border-red-500 focus:ring-1 focus:ring-red-500/50"
            : "border-zinc-800 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50"
        }`}
        {...register}
      />
      {/* Fixed Position Lock Icon */}
      <div className="absolute left-3 top-3.5 h-4 w-4 flex items-center justify-center text-zinc-500 transition-colors duration-300 group-focus-within:text-violet-400 group-hover:text-zinc-400">
        <Lock className="h-4 w-4" />
      </div>
      {/* Interactive Toggle Button */}
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-3.5 text-zinc-500 hover:text-violet-400 transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none"
        disabled={isLoading}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      {error && (
        <p className="mt-1 text-xs text-red-500 pl-1 animate-in slide-in-from-top-1">
          {error}
        </p>
      )}
    </div>
  );
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs border-b border-zinc-800/50 last:border-0 pb-1 last:pb-0">
      <span className="text-zinc-500 font-medium">{label}</span>
      <span className="text-zinc-300 font-medium truncate max-w-[150px]">
        {value}
      </span>
    </div>
  );
}