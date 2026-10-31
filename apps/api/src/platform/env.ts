import { z } from "zod";

// Optional providers default to "" and stay disabled when empty.
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z.url(),
  API_URL: z.url(),
  APP_URL: z.url(),
  PROTO_PUBLIC_ORIGIN: z.union([z.url(), z.literal("")]).default(""),
  PROTO_RENDER_ORIGIN: z.union([z.url(), z.literal("")]).default(""),
  PROTO_TICKET_SECRET: z.union([z.string().min(32), z.literal("")]).default(""),
  PROTO_REVIEW_EMAILS: z.string().default(""),
  PROTO_GALLERY_DIR: z.string().default("../app/dist-proto"),
  BETTER_AUTH_SECRET: z.string().min(32),
});

export type ApiEnv = z.infer<typeof envSchema>;

/** Parse the environment once at startup and fail with every missing or invalid key. */
export function loadEnv(input: Record<string, string | undefined> = process.env): ApiEnv {
  const result = envSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      `Missing or invalid environment: ${result.error.issues.map(i => i.path.join(".")).join(", ")}`
    );
  return result.data;
}
