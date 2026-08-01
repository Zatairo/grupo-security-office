-- CreateTable
CREATE TABLE "import_mappings" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mappings" JSONB NOT NULL,
    "userId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_mappings_userId_idx" ON "import_mappings"("userId");
