-- Atomic vacancy closure when an application changes from active to Accepted.
-- This trigger intentionally does not run for historic imported rows (INSERT).
CREATE TRIGGER IF NOT EXISTS rsagp_accept_closes_vacancy
AFTER UPDATE OF payload ON records
WHEN NEW.bucket = 'jobApplications'
 AND json_extract(NEW.payload, '$[9]') = 'Accepted'
 AND json_extract(OLD.payload, '$[9]') <> 'Accepted'
BEGIN
 UPDATE records SET
  payload=json_set(payload,'$[6]',json('false'),'$[8]',strftime('%Y-%m-%dT%H:%M:%fZ','now'),'$[9]',json_extract(NEW.payload,'$[12]')),
  updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE bucket='careerPositions' AND record_id=json_extract(NEW.payload,'$[5]')
   AND json_extract(payload,'$[6]')=1;
 SELECT CASE WHEN changes()=0 THEN RAISE(ABORT,'Vacancy is closed or missing') END;
END;
