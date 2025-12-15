// Always build after adding a new function!!

// Inserts data into DB
// Reusable across tRPC, cron jobs, other workers, etc.
// No HTTP/API concerns
import { getDb } from "@/db/database";
import { linkClicks, links } from "@/drizzle-out/schema";
import {
  CreateLinkSchemaType,
  destinationsSchema,
  DestinationsSchemaType,
  linkSchema,
} from "@/zod/links";
import { nanoid } from "nanoid";
import { and, desc, eq, gt } from "drizzle-orm";
import { LinkClickMessageType } from "@/zod/queue";

// Going to be used in tRPC route
export async function createLink(
  // Defined in Zod schemas
  // Account Id is omitted on the schema and passed in by tRPC instead
  data: CreateLinkSchemaType & { accountId: string }
) {
  const db = getDb();
  const id = nanoid(10);
  // Pass in links table
  await db.insert(links).values({
    linkId: id,
    accountId: data.accountId,
    name: data.name,
    destinations: JSON.stringify(data.destinations),
  });
  return id;
}

// We wanna see all the links for a given account and pagination by date
export async function getLinks(accountId: string, createdBefore?: string) {
  const db = getDb();

  // Filters of the query by account ID
  const conditions = [eq(links.accountId, accountId)];

  // Greater than query
  if (createdBefore) {
    conditions.push(gt(links.created, createdBefore));
  }

  // Simple select
  const result = await db
    .select({
      linkId: links.linkId,
      destinations: links.destinations,
      created: links.created,
      name: links.name,
    })
    .from(links)
    .where(and(...conditions))
    .orderBy(desc(links.created))
    .limit(25);

  return result.map((link) => ({
    ...link,
    lastSixHours: Array.from({ length: 6 }, () =>
      Math.floor(Math.random() * 100)
    ),
    linkClicks: 6,
    destinations: Object.keys(JSON.parse(link.destinations as string)).length,
  }));
}

export async function updateLinkName(linkId: string, name: string) {
  const db = getDb();
  await db
    .update(links)
    .set({
      name,
      updated: new Date().toISOString(),
    })
    .where(eq(links.linkId, linkId));
}

export async function getLink(linkId: string) {
  const db = getDb();

  const result = await db
    .select()
    .from(links)
    .where(eq(links.linkId, linkId))
    .limit(1);

  if (!result.length) {
    return null;
  }

  const link = result[0];
  const parsedLink = linkSchema.safeParse(link);
  if (!parsedLink.success) {
    console.log(parsedLink.error);
    throw new Error("BAD_REQUEST Error Parsing Link");
  }
  return parsedLink.data;
}

// Default destination of where a link is routed to
export async function updateLinkDestinations(
  linkId: string,
  destinations: DestinationsSchemaType
) {
  // Always parse before bad data makes it into DB
  const destinationsParsed = destinationsSchema.parse(destinations);
  const db = getDb();
  await db
    .update(links)
    .set({
      destinations: JSON.stringify(destinationsParsed),
      updated: new Date().toISOString(),
    })
    .where(eq(links.linkId, linkId));
}

// Ensure takes data from defined schema from zod for the queue
export async function addLinkClick(info: LinkClickMessageType["data"]) {
  // drizzle table
  const db = getDb();
  await db.insert(linkClicks).values({
    id: info.id,
    accountId: info.accountId,
    destination: info.destination,
    country: info.country,
    clickedTime: info.timestamp,
    latitude: info.latitude,
    longitude: info.longitude,
  });
}
