-- DropIndex
DROP INDEX "product_desc_gin";

-- DropIndex
DROP INDEX "product_name_gin";

-- DropIndex
DROP INDEX "product_sku_gin";

-- CreateTable
CREATE TABLE "import_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_sessions_userId_idx" ON "import_sessions"("userId");
