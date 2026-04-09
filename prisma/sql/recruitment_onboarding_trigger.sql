-- Trigger: when recruitment candidate status moves to hired/onboarding,
-- queue a domain event for onboarding access provisioning.

CREATE OR REPLACE FUNCTION trg_recruitment_candidate_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."statusCode" IN ('hired', 'onboarding')
     AND OLD."statusCode" IS DISTINCT FROM NEW."statusCode" THEN
    INSERT INTO "DomainEvent" ("id", "txId", "eventType", "payloadJson", "createdAt")
    VALUES (
      gen_random_uuid()::text,
      gen_random_uuid()::text,
      'hrm.recruitment.status_changed',
      jsonb_build_object(
        'candidateId', NEW.id,
        'oldStatus', OLD."statusCode",
        'newStatus', NEW."statusCode"
      ),
      now()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS recruitment_candidate_status_change ON "RecruitmentCandidate";

CREATE TRIGGER recruitment_candidate_status_change
AFTER UPDATE OF "statusCode" ON "RecruitmentCandidate"
FOR EACH ROW
EXECUTE FUNCTION trg_recruitment_candidate_status_change();
