-- CreateTable
CREATE TABLE "UserColumnPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserColumnPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserColumnPreference_userId_idx" ON "UserColumnPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserColumnPreference_userId_context_key" ON "UserColumnPreference"("userId", "context");

-- AddForeignKey
ALTER TABLE "UserColumnPreference" ADD CONSTRAINT "UserColumnPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
