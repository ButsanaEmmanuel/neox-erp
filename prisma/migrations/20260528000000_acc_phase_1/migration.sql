-- Access Control Center — phase 1.
-- Non-destructive: all new tables, no ALTER on existing ones except
-- relations Prisma adds implicitly via foreign keys. Existing
-- Permission / Role / RolePermission / UserRole / UserPermissionSet
-- semantics are preserved verbatim; assertPermission keeps working.

CREATE TABLE "AppModule" (
  "id"         TEXT NOT NULL,
  "moduleKey"  TEXT NOT NULL,
  "moduleName" TEXT NOT NULL,
  "sortOrder"  INTEGER NOT NULL DEFAULT 0,
  "icon"       TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppModule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AppModule_moduleKey_key" ON "AppModule"("moduleKey");

CREATE TABLE "AppPage" (
  "id"               TEXT NOT NULL,
  "moduleId"         TEXT NOT NULL,
  "parentPageId"     TEXT,
  "pageKey"          TEXT NOT NULL,
  "pageName"         TEXT NOT NULL,
  "route"            TEXT,
  "icon"             TEXT,
  "sortOrder"        INTEGER NOT NULL DEFAULT 0,
  "isSidebarVisible" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppPage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AppPage_pageKey_key" ON "AppPage"("pageKey");
CREATE INDEX "AppPage_moduleId_idx" ON "AppPage"("moduleId");
CREATE INDEX "AppPage_parentPageId_idx" ON "AppPage"("parentPageId");
ALTER TABLE "AppPage"
  ADD CONSTRAINT "AppPage_moduleId_fkey"
  FOREIGN KEY ("moduleId") REFERENCES "AppModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AppPage"
  ADD CONSTRAINT "AppPage_parentPageId_fkey"
  FOREIGN KEY ("parentPageId") REFERENCES "AppPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "RolePageAccess" (
  "id"        TEXT NOT NULL,
  "roleId"    TEXT NOT NULL,
  "pageId"    TEXT NOT NULL,
  "canView"   BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RolePageAccess_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RolePageAccess_roleId_pageId_key" ON "RolePageAccess"("roleId", "pageId");
CREATE INDEX "RolePageAccess_pageId_idx" ON "RolePageAccess"("pageId");
ALTER TABLE "RolePageAccess"
  ADD CONSTRAINT "RolePageAccess_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePageAccess"
  ADD CONSTRAINT "RolePageAccess_pageId_fkey"
  FOREIGN KEY ("pageId") REFERENCES "AppPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PermissionAction" (
  "id"          TEXT NOT NULL,
  "actionKey"   TEXT NOT NULL,
  "actionName"  TEXT NOT NULL,
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PermissionAction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PermissionAction_actionKey_key" ON "PermissionAction"("actionKey");

CREATE TABLE "RoleActionPermission" (
  "id"        TEXT NOT NULL,
  "roleId"    TEXT NOT NULL,
  "pageId"    TEXT NOT NULL,
  "actionId"  TEXT NOT NULL,
  "allowed"   BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoleActionPermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RoleActionPermission_roleId_pageId_actionId_key"
  ON "RoleActionPermission"("roleId", "pageId", "actionId");
CREATE INDEX "RoleActionPermission_pageId_idx" ON "RoleActionPermission"("pageId");
CREATE INDEX "RoleActionPermission_actionId_idx" ON "RoleActionPermission"("actionId");
ALTER TABLE "RoleActionPermission"
  ADD CONSTRAINT "RoleActionPermission_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleActionPermission"
  ADD CONSTRAINT "RoleActionPermission_pageId_fkey"
  FOREIGN KEY ("pageId") REFERENCES "AppPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoleActionPermission"
  ADD CONSTRAINT "RoleActionPermission_actionId_fkey"
  FOREIGN KEY ("actionId") REFERENCES "PermissionAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "RoleDataScope" (
  "id"         TEXT NOT NULL,
  "roleId"     TEXT NOT NULL,
  "moduleKey"  TEXT NOT NULL,
  "pageKey"    TEXT,
  "scopeType"  TEXT NOT NULL,
  "customRule" JSONB,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoleDataScope_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "RoleDataScope_roleId_moduleKey_idx" ON "RoleDataScope"("roleId", "moduleKey");
CREATE INDEX "RoleDataScope_roleId_pageKey_idx" ON "RoleDataScope"("roleId", "pageKey");
ALTER TABLE "RoleDataScope"
  ADD CONSTRAINT "RoleDataScope_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FieldPermission" (
  "id"         TEXT NOT NULL,
  "roleId"     TEXT NOT NULL,
  "moduleKey"  TEXT NOT NULL,
  "entityName" TEXT NOT NULL,
  "fieldName"  TEXT NOT NULL,
  "canView"    BOOLEAN NOT NULL DEFAULT TRUE,
  "canEdit"    BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FieldPermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FieldPermission_roleId_entityName_fieldName_key"
  ON "FieldPermission"("roleId", "entityName", "fieldName");
CREATE INDEX "FieldPermission_roleId_moduleKey_idx" ON "FieldPermission"("roleId", "moduleKey");
ALTER TABLE "FieldPermission"
  ADD CONSTRAINT "FieldPermission_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CrossModuleWorkflow" (
  "id"           TEXT NOT NULL,
  "workflowKey"  TEXT NOT NULL,
  "name"         TEXT NOT NULL,
  "sourceModule" TEXT NOT NULL,
  "description"  TEXT,
  "isActive"     BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrossModuleWorkflow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CrossModuleWorkflow_workflowKey_key" ON "CrossModuleWorkflow"("workflowKey");

CREATE TABLE "CrossModuleWorkflowModule" (
  "id"               TEXT NOT NULL,
  "workflowId"       TEXT NOT NULL,
  "moduleKey"        TEXT NOT NULL,
  "relationshipType" TEXT NOT NULL,
  CONSTRAINT "CrossModuleWorkflowModule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CrossModuleWorkflowModule_workflowId_moduleKey_key"
  ON "CrossModuleWorkflowModule"("workflowId", "moduleKey");
ALTER TABLE "CrossModuleWorkflowModule"
  ADD CONSTRAINT "CrossModuleWorkflowModule_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "CrossModuleWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CrossModuleWorkflowStep" (
  "id"                TEXT NOT NULL,
  "workflowId"        TEXT NOT NULL,
  "stepOrder"         INTEGER NOT NULL,
  "stepName"          TEXT NOT NULL,
  "responsibleRoleId" TEXT,
  "actionRequired"    TEXT NOT NULL,
  "conditionType"     TEXT,
  "conditionValue"    TEXT,
  "conditionCurrency" TEXT,
  "escalationRoleId"  TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrossModuleWorkflowStep_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CrossModuleWorkflowStep_workflowId_stepOrder_key"
  ON "CrossModuleWorkflowStep"("workflowId", "stepOrder");
CREATE INDEX "CrossModuleWorkflowStep_responsibleRoleId_idx" ON "CrossModuleWorkflowStep"("responsibleRoleId");
ALTER TABLE "CrossModuleWorkflowStep"
  ADD CONSTRAINT "CrossModuleWorkflowStep_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "CrossModuleWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LinkedRecordPermission" (
  "id"               TEXT NOT NULL,
  "roleId"           TEXT NOT NULL,
  "sourceModule"     TEXT NOT NULL,
  "targetModule"     TEXT NOT NULL,
  "sourceRecordType" TEXT NOT NULL,
  "targetRecordType" TEXT NOT NULL,
  "visibilityLevel"  TEXT NOT NULL,
  "allowedActions"   TEXT[] NOT NULL DEFAULT '{}',
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LinkedRecordPermission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LinkedRecordPermission_roleId_sourceRecordType_targetRecord_key"
  ON "LinkedRecordPermission"("roleId", "sourceRecordType", "targetRecordType");
CREATE INDEX "LinkedRecordPermission_roleId_sourceModule_idx" ON "LinkedRecordPermission"("roleId", "sourceModule");
ALTER TABLE "LinkedRecordPermission"
  ADD CONSTRAINT "LinkedRecordPermission_roleId_fkey"
  FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ApprovalWorkflow" (
  "id"          TEXT NOT NULL,
  "workflowKey" TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "moduleKey"   TEXT NOT NULL,
  "description" TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ApprovalWorkflow_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApprovalWorkflow_workflowKey_key" ON "ApprovalWorkflow"("workflowKey");

CREATE TABLE "ApprovalStep" (
  "id"                TEXT NOT NULL,
  "workflowId"        TEXT NOT NULL,
  "stepOrder"         INTEGER NOT NULL,
  "approverRoleId"    TEXT NOT NULL,
  "conditionType"     TEXT,
  "conditionValue"    TEXT,
  "conditionCurrency" TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ApprovalStep_workflowId_stepOrder_key" ON "ApprovalStep"("workflowId", "stepOrder");
CREATE INDEX "ApprovalStep_approverRoleId_idx" ON "ApprovalStep"("approverRoleId");
ALTER TABLE "ApprovalStep"
  ADD CONSTRAINT "ApprovalStep_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PermissionAuditLog" (
  "id"            TEXT NOT NULL,
  "roleId"        TEXT,
  "userId"        TEXT,
  "changedBy"     TEXT NOT NULL,
  "changeType"    TEXT NOT NULL,
  "entityType"    TEXT NOT NULL,
  "entityId"      TEXT,
  "previousValue" JSONB,
  "newValue"      JSONB,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PermissionAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PermissionAuditLog_roleId_createdAt_idx" ON "PermissionAuditLog"("roleId", "createdAt");
CREATE INDEX "PermissionAuditLog_userId_createdAt_idx" ON "PermissionAuditLog"("userId", "createdAt");
CREATE INDEX "PermissionAuditLog_entityType_entityId_idx" ON "PermissionAuditLog"("entityType", "entityId");
