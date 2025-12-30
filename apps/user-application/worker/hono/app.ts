import { Hono } from "hono";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/worker/trpc/router";
import { createContext } from "@/worker/trpc/context";
import { getAuth } from "@repo/data-ops/auth";
import { createMiddleware } from "hono/factory";

export const App = new Hono<{
  Bindings: ServiceBindings;
  Variables: { userId: string };
}>();

// Create Hono middleware that sits between requests to the route
const authMiddleware = createMiddleware(async (c, next) => {
  const auth = getAuthInstance(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.text("Unauthorized", 401);
  }
  const userId = session.user.id;
  // Attach user info to context so it can be accessed in other routes
  c.set("userId", userId);
  // Pipe request through
  await next();
});

// Handle all API auth stuff
App.on(["POST", "GET"], "/api/auth/*", (c) => {
  // const auth = getAuth({
  //   clientId: c.env.GOOGLE_CLIENT_ID,
  //   clientSecret: c.env.GOOGLE_CLIENT_SECRET,
  // });
  // return auth.handler(c.req.raw);
  const auth = getAuthInstance(c.env);
  return auth.handler(c.req.raw);
});

const getAuthInstance = (env: Env) => {
  // Better auth will make API calls to Stripe for us
  // You could also manage plans from DB and other stuff, but not necessary here
  // Like you could set a free trial for x days or allow quantity or annual discounts
  return getAuth(
    // All these secrets will eventually need to be in Cloudflare too
    {
      // Real webhook events to process stuff inside application
      stripeWebhookSecret: env.STRIPE_WEBHOOK_KEY,
      stripeApiKey: env.STRIPE_SECRET_KEY,
      plans: [
        {
          name: "basic",
          priceId: env.STRIPE_PRODUCT_BASIC,
        },
        {
          name: "pro",
          priceId: env.STRIPE_PRODUCT_PRO,
        },
        {
          name: "enterprise",
          priceId: env.STRIPE_PRODUCT_ENTERPRISE,
        },
      ],
    },
    {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    // Save to Cloudflare too
    env.APP_SECRET
  );
};

// tRPC routes
App.all("/trpc/*", authMiddleware, (c) => {
  const userId = c.get("userId");
  return fetchRequestHandler({
    endpoint: "/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: () =>
      createContext({
        req: c.req.raw,
        env: c.env,
        workerCtx: c.executionCtx as unknown as ExecutionContext,
        userId,
      }),
  });
});

App.get("/click-socket", authMiddleware, async (c) => {
  const userId = c.get("userId");
  // Clone headers and add account-id for backend authentication
  const headers = new Headers(c.req.raw.headers);
  headers.set("account-id", userId);

  // Create new request preserving the original URL and WebSocket upgrade
  const url = new URL(c.req.url);
  url.pathname = "/click-socket";

  const proxiedRequest = new Request(url.toString(), {
    method: c.req.method,
    headers: headers,
  });

  return c.env.BACKEND_SERVICE.fetch(proxiedRequest);
});
