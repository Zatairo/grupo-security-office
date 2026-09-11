-- AlterTable
ALTER TABLE "users" ADD COLUMN     "supervisorId" TEXT;

-- CreateIndex
CREATE INDEX "users_supervisorId_idx" ON "users"("supervisorId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add check constraint to prevent self-supervision
ALTER TABLE "users" ADD CONSTRAINT "users_supervisor_not_self"
  CHECK ("supervisorId" IS NULL OR "supervisorId" <> "id");
