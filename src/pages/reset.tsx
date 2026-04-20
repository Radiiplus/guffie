/**
 * Reset Password Page
 * Allows users to reset their password using their Username and Private Key.
 */
"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRight, Key, User, AlertCircle, ChevronLeft, ShieldCheck } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import * as z from "zod";

// Import Components
import { NeonLogo } from "@/components/logo";
import { InputGroup, PasswordInput } from "@/components/inputs";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

// --- Validation Schema ---
const resetStep1Schema = z.object({
  username: z.string().min(1, "Username is required"),
  privateKey: z.string().min(1, "Private Key is required"),
});

const resetStep2Schema = z.object({
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain uppercase")
    .regex(/[a-z]/, "Must contain lowercase")
    .regex(/[0-9]/, "Must contain number"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type Step1FormValues = z.infer<typeof resetStep1Schema>;
type Step2FormValues = z.infer<typeof resetStep2Schema>;
type AllFormValues = Step1FormValues & Step2FormValues;

export default function ResetPassword() {
  const [step, setStep] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [countdown, setCountdown] = React.useState(3);
  
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isSuccess) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            navigate("/login");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isSuccess, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<AllFormValues>({
    resolver: async (data) => {
      try {
        const schema = step === 1 ? resetStep1Schema : resetStep2Schema;
        await schema.parseAsync(data);
        return { values: data, errors: {} };
      } catch (error: any) {
        return { values: {}, errors: error.fieldErrors || {} };
      }
    },
    defaultValues: {
      username: "",
      privateKey: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const watchedValues = watch();

  const onSubmitStep1 = async () => {
    // Just move to next step, validation is handled by zodResolver
    setStep(2);
  };

  const onSubmitStep2 = async (_data: AllFormValues) => {
    setIsLoading(true);
    setApiError(null);

    try {
      const response = await api.resetPassword(
        watchedValues.username,
        watchedValues.privateKey,
        watchedValues.newPassword
      );

      if (response.success) {
        setIsSuccess(true);
      } else {
        throw new Error(response.message || "Reset failed.");
      }

    } catch (err) {
      console.error("Reset Failed:", err);
      if (err instanceof Error) {
        setApiError(err.message);
      } else {
        setApiError("Invalid credentials or network error.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setApiError(null);
    setCountdown(3);
    setStep(1);
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-black px-4 text-white">
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap");
        .font-great-vibes { font-family: "Great Vibes", cursive; font-weight: 400; }
        @keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .animate-gradient { animation: gradient 8s ease infinite; }
      `}</style>

      <NeonLogo size="lg" className="mb-4" />

      <div className="w-full max-w-md rounded-3xl border border-violet-500/20 bg-zinc-950 shadow-[0_0_15px_-5px_rgba(0,0,0,0.5)] p-4 sm:p-5 relative overflow-hidden flex flex-col transition-colors duration-500 hover:border-violet-500/30">
        
        {isSuccess ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-center"
          >
            <motion.div 
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
              className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/50 shadow-lg shadow-green-500/20"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <ShieldCheck className="h-10 w-10 text-green-400" />
              </motion.div>
            </motion.div>
            
            <motion.h2 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-2"
            >
              Password Reset Successful! ✨
            </motion.h2>
            
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-sm text-zinc-400 mb-6 leading-relaxed"
            >
              Your password has been securely updated. You can now log in with your new credentials.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/10 border border-violet-500/20"
            >
              <div className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
              <span className="text-xs text-violet-300">
                Redirecting to login in {countdown}s...
              </span>
            </motion.div>
          </motion.div>
        ) : (
          <>
            {apiError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center animate-in slide-in-from-top-2 flex items-center justify-center gap-2">
                <AlertCircle className="h-3 w-3" />
                {apiError}
              </div>
            )}

            <div className="text-center mb-2">
              <h2 className="text-3xl font-bold text-white tracking-tight leading-tight">
                {step === 1 ? "Reset Password" : "Set New Password"}
              </h2>
              <p className="text-xs text-zinc-500 mt-1 font-medium">
                {step === 1 
                  ? "Enter your Username and Private Key to verify identity." 
                  : "Create a strong new password for your account."}
              </p>
              <div className="flex justify-center gap-2 mt-2">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-all duration-300 ${i === step ? "w-6 bg-violet-500" : "w-1 bg-zinc-800"}`}
                  />
                ))}
              </div>
            </div>

            <div className="relative flex-grow min-h-[160px]">
              <AnimatePresence mode="wait">
                <motion.form
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 flex flex-col justify-center space-y-4"
                  onSubmit={handleSubmit(step === 1 ? onSubmitStep1 : onSubmitStep2)}
                >
                  {step === 1 && (
                    <>
                      <InputGroup
                        icon={<User className="h-4 w-4" />}
                        placeholder="Username"
                        error={errors.username?.message}
                        {...register("username")}
                      />
                      <InputGroup
                        icon={<Key className="h-4 w-4" />}
                        placeholder="Private Key (120-bit)"
                        error={errors.privateKey?.message}
                        {...register("privateKey")}
                      />
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <PasswordInput
                        id="newPassword"
                        placeholder="New Password"
                        show={showNewPassword}
                        onToggle={() => setShowNewPassword(!showNewPassword)}
                        error={errors.newPassword?.message}
                        register={register("newPassword")}
                        isLoading={isLoading}
                      />
                      <PasswordInput
                        id="confirmPassword"
                        placeholder="Confirm New Password"
                        show={showConfirmPassword}
                        onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
                        error={errors.confirmPassword?.message}
                        register={register("confirmPassword")}
                        isLoading={isLoading}
                      />
                    </>
                  )}
                </motion.form>
              </AnimatePresence>
            </div>

            <div className="mt-2 flex items-center justify-between pt-1">
              {step > 1 ? (
                <Button
                  type="button"
                  onClick={handleBack}
                  disabled={isLoading}
                  className="h-11 px-4 rounded-xl border border-zinc-800 bg-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all text-sm font-medium active:scale-95"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" /> Back
                </Button>
              ) : (
                <div /> 
              )}

              <Button
                type="submit"
                onClick={handleSubmit(step === 1 ? onSubmitStep1 : onSubmitStep2)}
                disabled={isLoading}
                className="h-11 w-11 rounded-xl border border-violet-500/30 bg-violet-500/5 text-violet-400 hover:bg-violet-500/20 hover:border-violet-500/60 transition-all disabled:opacity-50 active:scale-95"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ArrowRight className="h-5 w-5" />
                )}
              </Button>
            </div>
          </>
        )}

        {!isSuccess && (
          <>
            <div className="relative my-2 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800/50"></div>
              </div>
              <div className="relative z-10 bg-zinc-950 px-3 text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
                Remembered?
              </div>
            </div>

            <div className="flex justify-center pb-0">
              <Button
                variant="ghost"
                className="group w-full justify-center rounded-xl border border-zinc-800/50 bg-zinc-900/10 h-11 text-sm font-medium text-zinc-500 transition-all duration-300 hover:bg-zinc-900/40 hover:text-zinc-300 hover:border-zinc-700 active:scale-[0.98]"
                asChild
              >
                <Link to="/login">
                  <ArrowRight className="mr-2 h-4 w-4 rotate-180 transition-transform duration-300 group-hover:translate-x-1" />
                  Back to Login
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
      
      <p className="mt-8 text-xs text-zinc-600 text-center max-w-xs">
        Ensure your Private Key is kept secure. Never share it with anyone.
      </p>
    </div>
  );
}
