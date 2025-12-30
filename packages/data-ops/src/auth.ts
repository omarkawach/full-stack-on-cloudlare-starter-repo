import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "./db/database";
// Only exists after
// pnpm run better-auth-generate
import {
  account,
  session,
  user,
  verification,
  subscription,
} from "./drizzle-out/auth-schema";
// import { organization } from "better-auth/plugins";
import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";

// Helps with:
// 1. Integrate with application
// 2. Manage config with CLI
let auth: ReturnType<typeof betterAuth>;

type StripeConfig = {
  stripeWebhookSecret: string;
  plans: any[];
  stripeApiKey?: string;
};

export function createBetterAuth(
  database: NonNullable<Parameters<typeof betterAuth>[0]>["database"],
  secret: string,
  stripeConfig?: StripeConfig,
  // Can extend logic as you bring more providers
  google?: { clientId: string; clientSecret: string }
): ReturnType<typeof betterAuth> {
  return betterAuth({
    database,
    secret: secret,
    // Let provider totally manage auth for us
    emailAndPassword: {
      enabled: false,
    },
    socialProviders: {
      google: {
        clientId: google?.clientId ?? "",
        clientSecret: google?.clientSecret ?? "",
      },
    },
    // Always create the schemas whenever you add a new plugin
    // plugins: [organization()]
    plugins: [
      // Generate new schema for users that have a Stripe customer ID
      // Run better-auth command again
      // Create column in D1 Studio or run `pnpm run generate` and paste Drizzle command
      // ALTER TABLE `user` ADD `stripe_customer_id` text;
      stripe({
        stripeClient: new Stripe(
          stripeConfig?.stripeApiKey || process.env.STRIPE_KEY!,
          {
            apiVersion: "2025-03-31.basil",
          }
        ),
        stripeWebhookSecret:
          stripeConfig?.stripeWebhookSecret ??
          process.env.STRIPE_WEBHOOK_SECRET!,
        createCustomerOnSignUp: true,
        subscription: {
          enabled: true,
          plans: stripeConfig?.plans ?? [],
        },
      }),
    ],
  });
}

// For client side user-application
export function getAuth(
  stripe: StripeConfig,
  google: {
    clientId: string;
    clientSecret: string;
  },
  // Very important!!
  secret: string
): ReturnType<typeof betterAuth> {
  if (auth) return auth;

  auth = createBetterAuth(
    drizzleAdapter(getDb(), {
      provider: "sqlite",
      // Provide references to these generate schemas
      schema: {
        user,
        session,
        account,
        verification,
        subscription,
      },
    }),
    secret,
    stripe,
    google
  );
  return auth;
}
