-- Wave 2 WF-010: Concurrency-safe task code generation.
-- Replaces the racy count()+while-loop pattern in TasksService.createBackOfficeTask()
-- with an atomic PostgreSQL sequence that is safe under any concurrency level.
CREATE SEQUENCE IF NOT EXISTS back_office_task_code_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;
