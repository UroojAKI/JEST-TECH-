-- Migration: 20261030170000_add_customer_number_seq
--
-- Provisions the customer_number_seq PostgreSQL sequence used by
-- CrmIdentityService.generateCustomerCode() to generate CUST-XXXXXX business identifiers.
--
-- Concurrency and Tenancy note:
-- The sequence is globally unique and monotonic across transactions.
-- Customer codes are formatted as CUST-000001, CUST-000002, etc.

CREATE SEQUENCE IF NOT EXISTS customer_number_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;
