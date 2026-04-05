ALTER TABLE session
  ADD COLUMN require_included_checked_baggage INTEGER NOT NULL DEFAULT 0;

ALTER TABLE session
  ADD COLUMN restrict_to_chinese_airlines INTEGER NOT NULL DEFAULT 0;
