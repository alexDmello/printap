import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  PRINTAP_JWT_SECRET: z.string().min(16, "PRINTAP_JWT_SECRET must be at least 16 characters").optional(),
  PRINTAP_ADMIN_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Printap <onboarding@resend.dev>"),
  NEXT_PUBLIC_ROOT_DOMAIN: z.string().default("mellod.in"),
  NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL: z.string().optional(),
});

function getRawEnv() {
  return {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    PRINTAP_JWT_SECRET: process.env.PRINTAP_JWT_SECRET,
    PRINTAP_ADMIN_SECRET: process.env.PRINTAP_ADMIN_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
    NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL: process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL,
  };
}

let cachedEnv: z.infer<typeof serverEnvSchema> | null = null;

export function getEnv() {
  if (cachedEnv) return cachedEnv;

  const raw = getRawEnv();
  const parsed = serverEnvSchema.safeParse(raw);

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:", parsed.error.flatten().fieldErrors);
    // In production, throw so deployment fails fast rather than serving broken state
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Environment validation failed: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
    }
    // In dev, return best-effort with defaults to avoid blocking local tasks
    return raw as unknown as z.infer<typeof serverEnvSchema>;
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}

/**
 * Returns the cryptographically secure JWT secret for Print Ticket signing.
 * Throws in production if missing.
 */
export function getJwtSecret(): Uint8Array {
  const secret = process.env.PRINTAP_JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("FATAL: PRINTAP_JWT_SECRET is required in production.");
    }
    console.warn("⚠️ [SECURITY WARNING] Using development fallback for PRINTAP_JWT_SECRET. Do not use in production.");
    return new TextEncoder().encode("dev-fallback-secret-minimum-32-chars-long!");
  }
  return new TextEncoder().encode(secret);
}
