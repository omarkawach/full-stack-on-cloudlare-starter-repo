// We should protect our routes in case someone somehow figures out the user IDs
// Add auth middleware to the hono app
export async function createContext({
  req,
  env,
  workerCtx,
  userId
}: {
  req: Request;
  env: ServiceBindings;
  workerCtx: ExecutionContext;
  userId?: string | undefined;
}) {
  return {
    req,
    env,
    workerCtx,
    userInfo: {
      userId: userId,
    },
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;

