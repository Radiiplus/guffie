/**
 * Login Page
 * Matches the design and flow of the Registration page (Icon Submit).
 */
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { Loader2, ArrowRight, LogIn, User, AlertCircle } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import * as z from "zod";

// Import Components
import { NeonLogo } from "@/components/logo";
import { InputGroup, PasswordInput } from "@/components/inputs";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useSessionUser } from "@/lib/session";
import { USERNAME_PATTERN } from "@/lib/validation";

// --- Validation Schema ---
const loginSchema = z.object({
  username: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(
      z
        .string()
        .min(3, "Username must be at least 3 characters")
        .max(20, "Username cannot exceed 20 characters")
        .regex(
          USERNAME_PATTERN,
          "Username can only contain lowercase letters, numbers, periods, and underscores",
        ),
    ),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);
  
  const navigate = useNavigate();
  const { setSessionUser, refreshSessionUser } = useSessionUser();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const completeAuth = async (
    response: Awaited<ReturnType<typeof api.login>>,
    redirect = true
  ) => {
    localStorage.setItem("auth_token", response.token);
    localStorage.setItem("username", response.user.username);
    setSessionUser({
      fullName: response.user.fullName,
      username: response.user.username,
      country: response.user.country,
      createdAt: response.user.createdAt,
      avatarUrl: null,
    });
    await refreshSessionUser();
    if (redirect) navigate("/");
  };

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    setApiError(null);

    try {
      const response = await api.login(data.username.toLowerCase(), data.password);
      await completeAuth(response, true);

    } catch (err) {
      console.error("Login Failed:", err);
      if (err instanceof Error) {
        setApiError(err.message);
      } else {
        setApiError("Invalid credentials or network error.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-black px-4 text-white">
      {/* Global Styles */}
      <style>{`
        @import url("https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap");
        .font-great-vibes { font-family: "Great Vibes", cursive; font-weight: 400; }
        @keyframes gradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .animate-gradient { animation: gradient 8s ease infinite; }
      `}</style>

      <NeonLogo size="lg" className="mb-4" />

      {/* Main Card */}
      <div className="w-full max-w-md rounded-3xl border border-violet-500/20 bg-zinc-950 shadow-[0_0_15px_-5px_rgba(0,0,0,0.5)] p-4 sm:p-5 relative overflow-hidden flex flex-col transition-colors duration-500 hover:border-violet-500/30">
        
        {/* Error Display */}
        {apiError && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center animate-in slide-in-from-top-2 flex items-center justify-center gap-2">
            <AlertCircle className="h-3 w-3" />
            {apiError}
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-2">
          <h2 className="text-3xl font-bold text-white tracking-tight leading-tight">
            Welcome Back
          </h2>
          <p className="text-xs text-zinc-500 mt-1 font-medium">
            Enter your credentials to access your account.
          </p>
        </div>

        {/* Form Area */}
        <div className="relative flex-grow min-h-[160px]">
          <motion.form
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 flex flex-col justify-center space-y-4"
            onSubmit={handleSubmit(onSubmit)}
          >
            <InputGroup
              icon={<User className="h-4 w-4" />}
              placeholder="Username"
              error={errors.username?.message}
              {...register("username")}
            />

            <PasswordInput
              id="password"
              placeholder="Password"
              show={showPassword}
              onToggle={() => setShowPassword(!showPassword)}
              error={errors.password?.message}
              register={register("password")}
              isLoading={isLoading}
            />
            
            {/* Forgot Password Link */}
            <div className="flex justify-end pt-1">
              <button
                type="button"
                className="text-xs text-zinc-500 hover:text-violet-400 transition-colors font-medium"
                onClick={() => navigate("/reset")}
              >
                Forgot password?
              </button>
            </div>

          </motion.form>
        </div>

        {/* Navigation (Matches Register Layout) */}
        <div className="mt-2 flex items-center justify-between pt-1">
          {/* Left Side: Empty or Back Button if needed */}
          <div /> 

          {/* Right Side: Submit Icon Button */}
          <Button
            type="submit"
            onClick={handleSubmit(onSubmit)}
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

        {/* Footer Divider */}
        <div className="relative my-2 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800/50"></div>
          </div>
          <div className="relative z-10 bg-zinc-950 px-3 text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
            New here?
          </div>
        </div>

        {/* Register Link */}
        <div className="flex justify-center pb-0">
          <Button
            variant="ghost"
            className="group w-full justify-center rounded-xl border border-zinc-800/50 bg-zinc-900/10 h-11 text-sm font-medium text-zinc-500 transition-all duration-300 hover:bg-zinc-900/40 hover:text-zinc-300 hover:border-zinc-700 active:scale-[0.98]"
            asChild
          >
            <Link to="/register">
              <LogIn className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:rotate-180" />
              Create a new account
            </Link>
          </Button>
        </div>
      </div>
      
      {/* Simple Footer Text */}
      <p className="mt-8 text-xs text-zinc-600 text-center max-w-xs">
        By logging in, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}
