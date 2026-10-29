-- Run once in the Supabase SQL editor (after tracker_schema.sql).
-- Lets people edit their question list later: removed questions are hidden, not deleted,
-- so past runs keep their history.
alter table tracker_questions add column if not exists removed boolean not null default false;
