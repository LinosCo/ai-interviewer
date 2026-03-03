-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('OWNER', 'MEMBER');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "isPersonal" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProjectAccess" ADD COLUMN "role" "ProjectRole" NOT NULL DEFAULT 'MEMBER';
