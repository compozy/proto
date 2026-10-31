import { z } from "zod";

const parsed = z.object({ VITE_API_URL: z.url() }).safeParse(import.meta.env);
if (!parsed.success)
  throw new Error(
    `Missing or invalid configuration: ${parsed.error.issues.map(i => i.path.join(".")).join(", ")}`
  );
export const config = parsed.data;
