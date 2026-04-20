// src/lib/validation.ts
import * as z from "zod";
import countriesData from "./countries.json"; // Ensure this path matches your file location

// Define the type for the imported JSON
type CountryRaw = { alpha2: string; name: string };

// Process the data
export const COUNTRIES = countriesData as CountryRaw[];

// Extract codes as a tuple for Zod Enum safety
const countryCodes = COUNTRIES.map((c) => c.alpha2) as [string, ...string[]];

export const USERNAME_PATTERN = /^[a-z0-9._]+$/;
export const FULL_NAME_PATTERN = /^[\p{L}\p{N}\s._]+$/u;

// Helper to create a trimmed string schema with min/max
const trimmedString = (
  min: number,
  max: number,
  messageMin: string,
  messageMax: string,
) =>
  z
    .string()
    .transform((val) => val.trim())
    .pipe(
      z
        .string()
        .min(min, messageMin)
        .max(max, messageMax)
        .refine(
          (val) => FULL_NAME_PATTERN.test(val),
          "Full name can only contain letters, numbers, spaces, periods, and underscores.",
        ),
    );

export const registerSchema = z
  .object({
    fullName: trimmedString(
      2,
      30,
      "Full name must be at least 2 characters",
      "Full name cannot exceed 30 characters",
    ),

    username: trimmedString(
      3,
      20,
      "Username must be at least 3 characters",
      "Username cannot exceed 20 characters",
    )
      .transform((val) => val.toLowerCase())
      .pipe(
      z
        .string()
        .regex(
          USERNAME_PATTERN,
          "Username can only contain lowercase letters, numbers, periods, and underscores",
        ),
      ),

    password: z
      .string()
      .transform((val) => val.trim())
      .pipe(
        z
          .string()
          .min(8, "Password must be at least 8 characters")
          .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
          .regex(/[a-z]/, "Password must contain at least one lowercase letter")
          .regex(/[0-9]/, "Password must contain at least one number"),
      ),

    confirmPassword: z.string().transform((val) => val.trim()),

    // Dynamic Enum based on JSON
    country: z.enum(countryCodes, {
      error: "Please select a valid country",
    }),

    terms: z.boolean().refine((val) => val === true, {
      message: "You must accept the terms and conditions",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;
