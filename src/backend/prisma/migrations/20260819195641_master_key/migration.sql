-- CreateTable
CREATE TABLE "master_keys" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "master_keys_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "master_keys" ADD CONSTRAINT "master_keys_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
