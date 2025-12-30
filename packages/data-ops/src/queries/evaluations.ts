import { getDb } from "@/db/database";
import { destinationEvaluations } from "@/drizzle-out/schema";
import { and, desc, eq, gt } from "drizzle-orm";

// Basic drizzle query that takes in specific params, gets db, unique id for eval
// Then insert into db
export async function addEvaluation(data: {
  evaluationId: string;
  linkId: string;
  accountId: string;
  destinationUrl: string;
  status: string;
  reason: string;
}) {
  const db = getDb();

  await db.insert(destinationEvaluations).values({
    id: data.evaluationId,
    linkId: data.linkId,
    accountId: data.accountId,
    destinationUrl: data.destinationUrl,
    status: data.status,
    reason: data.reason,
  });
}


// Queries for all products that are not available
// Helpful for UI
export async function getNotAvailableEvaluations(accountId: string) {
  const db = getDb();
  const result = await db
    .select()
    .from(destinationEvaluations)
    .where(
      and(
        eq(destinationEvaluations.accountId, accountId),
        eq(destinationEvaluations.status, "NOT_AVAILABLE_PRODUCT")
      )
    )
    .orderBy(desc(destinationEvaluations.createdAt))
    .limit(20);

  return result;
}

// Query based upon an accountId and sorted by created time and recent evals, limited by 20
// Helpful for UI
export async function getEvaluations(
  accountId: string,
  // for pagination
  createdBefore?: string
) {
  const db = getDb();

  const conditions = [eq(destinationEvaluations.accountId, accountId)];

  if (createdBefore) {
    conditions.push(gt(destinationEvaluations.createdAt, createdBefore));
  }

  const result = await db
    .select()
    .from(destinationEvaluations)
    .where(and(...conditions))
    .orderBy(desc(destinationEvaluations.createdAt))
    .limit(25);

  return result;
}
