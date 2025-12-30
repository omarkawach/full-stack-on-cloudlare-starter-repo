import type { Config } from "drizzle-kit";

const config: Config = {
  // This is where the TS files go for Drizzle schemas
  out: "./src/drizzle-out",
  dialect: "sqlite",
  driver: "d1-http",
  // Generate a SQL file with our create statement
  // Copy them to D1 studio for stage first and then production
  // Should create account, session, user and verification schemas
  schema: ["./src/drizzle-out/auth-schema.ts"],
  // How to auth to database
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: process.env.CLOUDFLARE_DATABASE_ID!,
    token: process.env.CLOUDFLARE_D1_TOKEN!,
  },
  tablesFilter: ["!_cf_KV"],
};

export default config satisfies Config;
