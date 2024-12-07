import sequelize from "../database/sequelize";
import { procedure, router } from "../trpc";
import { authIntegration } from "../auth";

export default router({
  // TODO: Should we require an Admin auth token separate from integration
  // token?
  migrateDatabase: procedure
    .use(authIntegration())
    .mutation(async () => await migrateDatabase())
});

export async function migrateDatabase() {
  console.log("Migrating DB schema...");

  // Rename the old Partnerships table to Mentorships
  await sequelize.query(`
    DO $$ 
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'Partnerships'
      ) THEN
        ALTER TABLE "Partnerships" RENAME TO "Mentorships";
      END IF;
    END $$;
  `);

  // Replace AdhocMentor with TransactionalMentor in users.roles array
  await sequelize.query(`
    DO $$ 
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'users'
      ) THEN
        UPDATE "users" 
        SET roles = array_replace(roles, 'AdhocMentor', 'TransactionalMentor')
        WHERE 'AdhocMentor' = ANY (roles);
      END IF;
    END $$;
  `);

  // Rename endedAt to relationalEndedAt in Mentorships table
  await sequelize.query(`
    DO $$ 
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Mentorships' AND column_name = 'endedAt'
      ) THEN
        ALTER TABLE "Mentorships" RENAME COLUMN "endedAt" TO "relationalEndedAt";
      END IF;
    END $$;
  `);

  // Rename relationalEndedAt to endsAt in Mentorships table
  await sequelize.query(`
    DO $$ 
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Mentorships' AND column_name = 'relationalEndedAt'
      ) THEN
        ALTER TABLE "Mentorships" RENAME COLUMN "relationalEndedAt" TO "endsAt";
      END IF;
    END $$;
  `);
  
  // Add transactional column to Mentorships table and fill in data
  await sequelize.query(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Mentorships' AND column_name = 'transactional'
      ) THEN
        ALTER TABLE "Mentorships" ADD COLUMN "transactional" BOOLEAN DEFAULT false;
        UPDATE "Mentorships" SET "transactional" = false WHERE "transactional" IS NULL;
        ALTER TABLE "Mentorships" ALTER COLUMN "transactional" SET NOT NULL;
        ALTER TABLE "Mentorships" ALTER COLUMN "transactional" DROP DEFAULT;
      END IF;
    END $$;
  `);

  await dropParanoid();

  await sequelize.sync({ alter: { drop: false } });

  console.log("Migrating DB data...");
  await migrateFakeEmails();

  console.log("Clean up old DB data...");
  await cleanupFeedbackAttemptLogs();
}

async function migrateFakeEmails() {
  console.log("Migrating fake emails...");
  await sequelize.query(`
    UPDATE users SET "email" = REPLACE("email", '@ub.nd', '@f.ml')
    WHERE "email" LIKE '%@ub.nd';
  `);
}

async function cleanupFeedbackAttemptLogs() {
  console.log("Deleting old feedback attempt logs...");
  await sequelize.query(`
    DELETE FROM "InterviewFeedbackUpdateAttempts"
    WHERE "createdAt" < NOW() - INTERVAL '30 days';
  `);
}

async function dropParanoid() {
  for (const table of ["users", "groups", "group_users", "Transcripts",
    "Summaries", "Interviews", "InterviewFeedbacks", "Assessments",
    "Calibrations"]) 
  {
    await sequelize.query(`
      DO $$ 
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = '${table}' AND column_name = 'deletedAt'
      ) THEN
        DELETE FROM "${table}" WHERE "deletedAt" IS NOT NULL;
        ALTER TABLE "${table}" DROP COLUMN "deletedAt";
      END IF;
      END $$;
    `);
  }
}
