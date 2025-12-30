import { t } from "@/worker/trpc/trpc-instance";
import { TRPCError } from "@trpc/server";

import { z } from "zod";
import {
  getEvaluations,
  getNotAvailableEvaluations,
} from "@repo/data-ops/queries/evaluations";

export const evaluationsTrpcRoutes = t.router({
  problematicDestinations: t.procedure.query(async ({ ctx }) => {
    const userId = ctx.userInfo.userId;
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
    return await getNotAvailableEvaluations(userId);
  }),
  recentEvaluations: t.procedure
    .input(
      z
        .object({
          createdBefore: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx }) => {
      const userId = ctx.userInfo.userId;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const evaluations = await getEvaluations(userId);

      const oldestCreatedAt =
        evaluations.length > 0
          ? evaluations[evaluations.length - 1].createdAt
          : null;

      return {
        data: evaluations,
        oldestCreatedAt,
      };
    }),
});