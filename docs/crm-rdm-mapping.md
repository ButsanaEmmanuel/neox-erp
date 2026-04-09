# CRM Reference Data Mapping (DB-Driven)

| Field Name | Current Mock Source | Target DB Table | API Endpoint |
|---|---|---|---|
| Organization | Hardcoded org/company values in forms | `Department` (organization scope fallback) | `GET /api/v1/crm/lookups?types=organizations` |
| Company | Local arrays / context-only values | `ClientAccount` | `GET /api/v1/crm/lookups?types=companies` |
| Deal Owner | Text input / hardcoded owner lists | `User` (active users) + `CrmDeal.ownerUserId` FK | `GET /api/v1/crm/lookups?types=owners` |
| Pipeline Stage | `CONTACT_STAGES` / `DEAL_STAGES` constants | `crm_ref_pipeline_stages` + `CrmDeal.stageRefId` FK | `GET /api/v1/crm/lookups?types=stages` |
| Industry | Free text / static values | `crm_ref_industries` + `ClientAccount.industryRefId` FK | `GET /api/v1/crm/lookups?types=industries` |
| Lead Source | Hardcoded/none | `crm_ref_sources` + `CrmDeal.sourceRefId` FK | `GET /api/v1/crm/lookups?types=sources` |
| Tags | Local/static arrays | `ClientAccount.tagsJson` (normalized through lookup endpoint) | `GET /api/v1/crm/lookups?types=tags` |

## Priority rollout applied
1. Deal Owner (DB users)
2. Organization (department scope fallback)
3. Pipeline Stages (CRM reference table)

## Notes
- `crm_ref_statuses` and `crm_ref_activity_types` are also available through the same multi-lookup endpoint.
- Current schema has no dedicated `Organization` entity, so `Department` is used as an explicit scoping source until organization tenancy model is introduced.
