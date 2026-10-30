-- Migration: 20261030120000_add_contact_number_seq
--
-- Creates the contact_number_seq PostgreSQL sequence used by
-- ContactRepository.generateContactCode() to produce CONT-XXXXXX identifiers.
--
-- Root cause: ContactRepository.generateContactCode() called nextval('contact_number_seq')
-- without a prior CREATE SEQUENCE migration. The sequence was only lazily created on the
-- first failure via a $executeRaw fallback in the catch block.
-- This caused "relation contact_number_seq does not exist" errors on fresh E2E test databases
-- and on any deployment environment where the sequence had never been initialized.
--
-- Fix: Create the sequence idempotently here. The lazy-creation fallback in
-- ContactRepository.generateContactCode() remains as defense-in-depth, but this migration
-- ensures the sequence is always provisioned before any contact is created.
--
-- NOTE: This sequence is tenant-agnostic and global across all companies.
-- The contact code is a display identifier only; it does not establish uniqueness
-- guarantees on its own. ContactRepository enforces uniqueness at the DB constraint level.

CREATE SEQUENCE IF NOT EXISTS contact_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;
