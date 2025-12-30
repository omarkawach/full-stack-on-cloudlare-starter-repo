import { createBetterAuth } from "@/auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";

export const auth: ReturnType<typeof betterAuth> = createBetterAuth(
  // Use Drizzle ORM adapter
  drizzleAdapter(
    // Empty DB
    {},
    // Provider for D1 SQLite
    {
      provider: "sqlite",
    }
  ),
  // For Better Auth secret
  ""
);
