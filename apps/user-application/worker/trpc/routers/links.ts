import { t } from "@/worker/trpc/trpc-instance";
import { z } from "zod";
import {
  createLinkSchema,
  destinationsSchema,
} from "@repo/data-ops/zod-schema/links";
import {
  activeLinksLastHour,
  createLink,
  getLast24And48HourClicks,
  getLast30DaysClicks,
  getLast30DaysClicksByCountry,
  getLink,
  getLinks,
  totalLinkClickLastHour,
  updateLinkDestinations,
  updateLinkName,
} from "@repo/data-ops/queries/links";

import { TRPCError } from "@trpc/server";

export const linksTrpcRoutes = t.router({
  linkList: t.procedure
    .input(
      z.object({
        offset: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.userInfo.userId;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      return await getLinks(userId, input.offset?.toString());
    }),
  // Specific mutation
  // Use Zod to define input data (from data-ops package), i.e., createLinkSchema
  // input, data and ctx from tRPC
  // ctx is context
  // This is the API layer defining the HTTP endpoints
  createLink: t.procedure
    .input(createLinkSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userInfo.userId;
      if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });

      const linkId = await createLink({
        accountId: userId,
        ...input,
      });
      return linkId;
    }),
  updateLinkName: t.procedure
    .input(
      z.object({
        linkId: z.string(),
        name: z.string().min(1).max(300),
      })
    )
    .mutation(async ({ input }) => {
      console.log(input.linkId, input.name);
      await updateLinkName(input.linkId, input.name);
    }),
  getLink: t.procedure
    .input(
      z.object({
        linkId: z.string(),
      })
    )
    .query(async ({ input }) => {
      const data = await getLink(input.linkId);
      // const data = {
      //   name: "My Sample Link",
      //   linkId: "link_123456789",
      //   accountId: "user_987654321",
      //   destinations: {
      //     default: "https://example.com",
      //     mobile: "https://mobile.example.com",
      //     desktop: "https://desktop.example.com",
      //   },
      //   created: "2024-01-15T10:30:00Z",
      //   updated: "2024-01-20T14:45:00Z",
      // };
      if (!data) throw new TRPCError({ code: "NOT_FOUND" });
      return data;
    }),
  updateLinkDestinations: t.procedure
    .input(
      z.object({
        linkId: z.string(),
        destinations: destinationsSchema,
      })
    )
    .mutation(async ({ input }) => {
      console.log(input.linkId, input.destinations);
      await updateLinkDestinations(input.linkId, input.destinations);
    }),
  activeLinks: t.procedure.query(async ({ ctx }) => {
    const userId = ctx.userInfo.userId;
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
    return await activeLinksLastHour(userId);
  }),
  totalLinkClickLastHour: t.procedure.query(async ({ ctx }) => {
    const userId = ctx.userInfo.userId;
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
    return await totalLinkClickLastHour(userId);
  }),
  last24HourClicks: t.procedure.query(async ({ ctx }) => {
    const userId = ctx.userInfo.userId;
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
    return await getLast24And48HourClicks(userId);
  }),
  last30DaysClicks: t.procedure.query(async ({ ctx }) => {
    const userId = ctx.userInfo.userId;
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
    return await getLast30DaysClicks(userId);
  }),
  clicksByCountry: t.procedure.query(async ({ ctx }) => {
    const userId = ctx.userInfo.userId;
    if (!userId) throw new TRPCError({ code: "UNAUTHORIZED" });
    return await getLast30DaysClicksByCountry(userId);
  }),
});
