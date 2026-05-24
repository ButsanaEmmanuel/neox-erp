-- Universal access engine primitives
CREATE TABLE IF NOT EXISTS "UserPermissionSet" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "effect" TEXT NOT NULL DEFAULT 'allow',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserPermissionSet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserPermissionSet_userId_module_resource_action_key"
  ON "UserPermissionSet"("userId", "module", "resource", "action");
CREATE INDEX IF NOT EXISTS "UserPermissionSet_userId_module_isActive_idx"
  ON "UserPermissionSet"("userId", "module", "isActive");

CREATE TABLE IF NOT EXISTS "ResourceStakeholder" (
  "id" TEXT PRIMARY KEY,
  "module" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "stakeholderRole" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ResourceStakeholder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ResourceStakeholder_module_resourceType_resourceId_userId_key"
  ON "ResourceStakeholder"("module", "resourceType", "resourceId", "userId");
CREATE INDEX IF NOT EXISTS "ResourceStakeholder_userId_module_isActive_idx"
  ON "ResourceStakeholder"("userId", "module", "isActive");
CREATE INDEX IF NOT EXISTS "ResourceStakeholder_module_resourceType_resourceId_isActive_idx"
  ON "ResourceStakeholder"("module", "resourceType", "resourceId", "isActive");
