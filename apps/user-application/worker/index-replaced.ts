import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./trpc/router";
import { createContext } from "./trpc/context";
import { initDatabase } from "@repo/data-ops/database"

// Exports default fetch handler
// Basically the same as apps/data-service/src/index.ts, but
// different syntax
export default {
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    // env.DB should be binded from wrangler.jsonc in user application
    // pnpm run cf-typegen after making changes to wrangler.jsonc
    initDatabase(env.DB)
    // If we go to this path, we will pass request to handler
    if (url.pathname.startsWith("/trpc")) {
      return fetchRequestHandler({
        endpoint: "/trpc",
        req: request,
        router: appRouter,
        // Implementing tRPC
        createContext: () =>
          createContext({ req: request, env: env, workerCtx: ctx, userId: undefined }),
      });
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<ServiceBindings>;
