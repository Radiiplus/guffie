/**
 * Registration Page
 * Implements real-time username validation.
 */
"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  ArrowRight,
  Globe,
  LogIn,
  ChevronLeft,
  User,
  AtSign,
  CheckCircle2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// Import Schema & Countries
import {
  registerSchema,
  type RegisterFormValues,
  COUNTRIES,
} from "@/lib/validation";

// Import Modular Components
import { NeonLogo } from "@/components/logo";
import { InputGroup, PasswordInput, DetailRow } from "@/components/inputs";
import { LegalModal } from "@/components/legal";
import { Button } from "@/components/ui/button";
import { SuccessModal } from "@/components/ui/success"; 
import { api } from "@/lib/api";

// Animation variants
const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0,
    scale: 0.98,
  }),
  center: { zIndex: 1, x: 0, opacity: 1, scale: 1 },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 50 : -50,
    opacity: 0,
    scale: 0.98,
  }),
};

export default function Register() {
  const [step, setStep] = React.useState(1);
  const [direction, setDirection] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [showLegalModal, setShowLegalModal] = React.useState(false);
  const [isPolicyAccepted, setIsPolicyAccepted] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);

  // Real-time Username Validation State
  const [usernameStatus, setUsernameStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [usernameMessage, setUsernameMessage] = React.useState<string>("");

  // Success State
  const [showSuccessModal, setShowSuccessModal] = React.useState(false);
  const [successData, setSuccessData] = React.useState<{
    pk: string;
    username: string;
  } | null>(null);

  const navigate = useNavigate();

  const {
    register,
    trigger,
    formState: { errors },
    watch,
    reset,
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      username: "",
      country: "",
      password: "",
      confirmPassword: "",
      terms: false,
    },
  });

  const watchedValues = watch();
  const usernameField = register("username", {
    setValueAs: (value: unknown) =>
      typeof value === "string" ? value.toLowerCase() : value,
  });

  // Real-time Username Check Effect
  React.useEffect(() => {
    const username = (watchedValues.username || "").toLowerCase().trim();
    
    // Reset status if empty or invalid format (let Zod handle format errors)
    if (!username || errors.username) {
      setUsernameStatus("idle");
      setUsernameMessage("");
      return;
    }

    // Debounce timer
    const timer = setTimeout(async () => {
      setUsernameStatus("loading");
      try {
        const result = await api.checkUsername(username);
        if (result.available) {
          setUsernameStatus("success");
          setUsernameMessage("Username is available");
        } else {
          setUsernameStatus("error");
          setUsernameMessage(result.message || "Username is taken");
        }
      } catch (err) {
        console.error("Username check failed:", err);
        setUsernameStatus("idle"); // Fail silently or show error
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [watchedValues.username, errors.username]);

  const nextStep = async () => {
    setApiError(null);
    
    // If username is not available, block progression
    if (step === 1 && usernameStatus !== "success") {
      // Trigger validation manually to show error if empty
      await trigger(["fullName", "username", "country"]);
      if (usernameStatus === "error") {
        // Focus on username input or just return
        return; 
      }
      if (usernameStatus === "idle" && watchedValues.username) {
         // Force a check if they click next without waiting for debounce
         // Optional: You can force the check here synchronously if desired
      }
    }

    let fieldsToValidate: (keyof RegisterFormValues)[] = [];
    if (step === 1) fieldsToValidate = ["fullName", "username", "country"];
    if (step === 2) fieldsToValidate = ["password", "confirmPassword"];

    const isValid = await trigger(fieldsToValidate);
    
    // Additional check for username availability on Step 1
    if (step === 1 && usernameStatus !== "success" && watchedValues.username) {
       // Prevent moving forward if username is taken
       return;
    }

    if (isValid) {
      setDirection(1);
      setStep((prev) => prev + 1);
    }
  };

  const prevStep = () => {
    setApiError(null);
    setDirection(-1);
    setStep((prev) => prev - 1);
  };

  const handleInitiateSubmit = () => {
    setApiError(null);
    setShowLegalModal(true);
    setIsPolicyAccepted(false);
  };

  const confirmAndSubmit = async (data: RegisterFormValues) => {
    console.log("confirmAndSubmit called with data:", data);
    setShowLegalModal(false);
    setIsLoading(true);
    setApiError(null);

    try {
      console.log("Calling api.register...");
      // Call Backend
      const response = await api.register({
        fullName: data.fullName,
        username: data.username.toLowerCase(),
        country: data.country,
        password: data.password,
        confirmPassword: data.confirmPassword,
        termsAccepted: data.terms,
      });

      // Store ONLY the Auth Token (Session)
      localStorage.setItem("auth_token", response.token);

      // Prepare Success Data
      setSuccessData({
        pk: response.user.pk,
        username: response.user.username,
      });

      // Show the PK Backup Modal
      setShowSuccessModal(true);
      reset();
    } catch (err) {
      console.error("Registration Failed:", err);
      if (err instanceof Error) {
        setApiError(err.message);
        // If error is about username, update status
        if (err.message.includes("Username")) {
          setUsernameStatus("error");
          setUsernameMessage(err.message);
        }
      } else {
        setApiError("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuccessConfirm = () => {
    setShowSuccessModal(false);
    setSuccessData(null);
    navigate("/login");
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
        {apiError && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center animate-in slide-in-from-top-2">
            {apiError}
          </div>
        )}

        <div className="text-center mb-2">
          <h2 className="text-3xl font-bold text-white tracking-tight leading-tight">
            {step === 1 && "Create Account"}
            {step === 2 && "Security"}
            {step === 3 && "Review"}
          </h2>
          <p className="text-xs text-zinc-500 mt-1 font-medium">
            {step === 1 && "Join the community today."}
            {step === 2 && "Secure your profile."}
            {step === 3 && "Final confirmation."}
          </p>
          <div className="flex justify-center gap-2 mt-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${i === step ? "w-6 bg-violet-500" : "w-1 bg-zinc-800"}`}
              />
            ))}
          </div>
        </div>

        <div className="relative grow min-h-50">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.form
              key={step}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute inset-0 flex flex-col justify-center space-y-4"
              onSubmit={(e) => e.preventDefault()}
            >
              {step === 1 && (
                <>
                  <InputGroup
                    icon={<User className="h-4 w-4" />}
                    placeholder="Full Name"
                    error={errors.fullName?.message}
                    {...register("fullName")}
                  />
                  <InputGroup
                    icon={<AtSign className="h-4 w-4" />}
                    placeholder="Username"
                    error={errors.username?.message || (usernameStatus === "error" ? usernameMessage : undefined)}
                    status={usernameStatus}
                    {...usernameField}
                  />
                  <div className="group relative">
                    <select
                      disabled={isLoading}
                      className={`h-11 w-full appearance-none rounded-xl border border-zinc-800 bg-zinc-900/50 pl-10 pr-8 text-sm font-medium focus:border-violet-500 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-violet-500/50 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 hover:border-zinc-700 cursor-pointer ${watchedValues.country ? "text-white" : "text-zinc-600"}`}
                      {...register("country")}
                    >
                      <option
                        value=""
                        disabled
                        className="bg-zinc-900 text-zinc-600"
                      >
                        Select Country
                      </option>
                      {COUNTRIES.map((c) => (
                        <option
                          key={c.alpha2}
                          value={c.alpha2}
                          className="bg-zinc-900 text-zinc-300"
                        >
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute left-3 top-3.5 h-4 w-4 flex items-center justify-center text-zinc-500 transition-colors duration-300 group-focus-within:text-violet-400 group-hover:text-zinc-400 pointer-events-none">
                      <Globe className="h-4 w-4" />
                    </div>
                    <ArrowRight className="absolute right-3 top-3.5 h-3 w-3 rotate-90 text-zinc-500 pointer-events-none group-hover:text-zinc-400 transition-colors" />
                    {errors.country && (
                      <p className="mt-1 text-xs text-red-500 pl-1 animate-in slide-in-from-top-1">
                        {errors.country.message}
                      </p>
                    )}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <PasswordInput
                    id="password"
                    placeholder="Password"
                    show={showPassword}
                    onToggle={() => setShowPassword(!showPassword)}
                    error={errors.password?.message}
                    register={register("password")}
                    isLoading={isLoading}
                  />
                  <PasswordInput
                    id="confirmPassword"
                    placeholder="Confirm Password"
                    show={showConfirmPassword}
                    onToggle={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    error={errors.confirmPassword?.message}
                    register={register("confirmPassword")}
                    isLoading={isLoading}
                  />
                </>
              )}

              {step === 3 && (
                <div className="flex flex-col items-center justify-center h-full space-y-3 text-center">
                  <div className="p-2.5 rounded-full bg-violet-500/10 border border-violet-500/20">
                    <CheckCircle2 className="w-7 h-7 text-violet-400" />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-base font-medium text-white">Ready?</h3>
                    <p className="text-xs text-zinc-500 font-medium">
                      Check your details.
                    </p>
                  </div>
                  <div className="w-full bg-zinc-900/30 rounded-xl border border-zinc-800 p-2.5 text-left space-y-1.5">
                    <DetailRow
                      label="Name"
                      value={watchedValues.fullName || "-"}
                    />
                    <DetailRow
                      label="Username"
                      value={watchedValues.username || "-"}
                    />
                    <DetailRow
                      label="Country"
                      value={
                        COUNTRIES.find(
                          (c) => c.alpha2 === watchedValues.country,
                        )?.name || "-"
                      }
                    />
                  </div>
                </div>
              )}
            </motion.form>
          </AnimatePresence>
        </div>

        <div className="mt-2 flex items-center justify-between pt-1">
          {step > 1 ? (
            <Button
              type="button"
              onClick={prevStep}
              disabled={isLoading}
              className="h-11 px-4 rounded-xl border border-zinc-800 bg-transparent text-zinc-500 hover:text-zinc-300 hover:border-zinc-700 transition-all text-sm font-medium active:scale-95"
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <Button
              type="button"
              onClick={nextStep}
              disabled={isLoading || (step === 1 && usernameStatus === "loading")}
              className="h-11 w-11 rounded-xl border border-zinc-800 bg-transparent text-zinc-400 hover:text-violet-400 hover:border-violet-500/50 transition-all disabled:opacity-50 active:scale-95"
            >
              <ArrowRight className="h-5 w-5" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleInitiateSubmit}
              disabled={isLoading}
              className="h-11 w-11 rounded-xl border border-violet-500/30 bg-violet-500/5 text-violet-400 hover:bg-violet-500/20 hover:border-violet-500/60 transition-all disabled:opacity-50 active:scale-95"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ArrowRight className="h-5 w-5" />
              )}
            </Button>
          )}
        </div>

        <div className="relative my-2 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-800/50"></div>
          </div>
          <div className="relative z-10 bg-zinc-950 px-3 text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
            Existing user?
          </div>
        </div>
        <div className="flex justify-center pb-0">
          <Button
            variant="ghost"
            className="group w-full justify-center rounded-xl border border-zinc-800/50 bg-zinc-900/10 h-11 text-sm font-medium text-zinc-500 transition-all duration-300 hover:bg-zinc-900/40 hover:text-zinc-300 hover:border-zinc-700 active:scale-[0.98]"
            onClick={() => navigate("/login")}
          >
            <LogIn className="mr-2 h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />{" "}
            Access existing account
          </Button>
        </div>
      </div>

      {/* Legal Modal */}
      <LegalModal
        isOpen={showLegalModal}
        onClose={() => setShowLegalModal(false)}
        type="terms"
        onAccept={() => {
          console.log("onAccept callback triggered");
          const dataWithTerms = { ...watchedValues, terms: true } as RegisterFormValues;
          confirmAndSubmit(dataWithTerms);
        }}
        isAccepted={isPolicyAccepted}
        setAccepted={setIsPolicyAccepted}
        isLoading={isLoading}
      />

      {/* NEW: Success/PK Backup Modal */}
      {successData && (
        <SuccessModal
          isOpen={showSuccessModal}
          pk={successData.pk}
          username={successData.username}
          onConfirm={handleSuccessConfirm}
        />
      )}
    </div>
  );
}
