import { procedure, router } from "../trpc";
import { authUser } from "../auth";
import { z } from "zod";
import db from "../database/db";
import { zTranscript } from "shared/Transcript";
import { notFoundError } from "api/errors";
import {
  groupAttributes,
  groupInclude,
  transcriptAttributes,
  summaryAttributes,
  minUserAttributes
} from "api/database/models/attributesAndIncludes";
import { checkPermissionForGroupHistory } from "./groups";
import { Op } from "sequelize";
import Summary from "api/database/models/Summary";
import invariant from 'tiny-invariant';

const list = procedure
  .use(authUser())
  .input(z.object({
    groupId: z.string(),
  }))
  .output(z.array(zTranscript))
  .query(async ({ input: { groupId }, ctx }) =>
{
  const g = await db.Group.findByPk(groupId, {
    attributes: groupAttributes,
    include: [...groupInclude, {
      model: db.Transcript,
      attributes: transcriptAttributes,
    }],
  });

  if (!g) throw notFoundError("分组", groupId);

  checkPermissionForGroupHistory(ctx.user, g);

  return g.transcripts;
});

/**
 * @return null if there is no transcript.
 */
const getMostRecentStartedAt = procedure
  .use(authUser(["MentorCoach", "MenteeManager"]))
  .input(z.object({
    groupId: z.string(),
  }))
  .output(z.date().nullable())
  .query(async ({ input: { groupId } }) =>
{
  return await db.Transcript.max("startedAt", { where: { groupId } });
});

export default router({
  list,
  getMostRecentStartedAt,
});

export async function getSummaries(transcriptId: string):
  Promise<Summary[]> {
  return await db.Summary.findAll({
    where: { transcriptId },
    attributes: summaryAttributes,
  });
}
