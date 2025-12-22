-- ============================================================================
-- Check EmployeeIntake_v1 and Employee_Onboarding_Intake Tables
-- ============================================================================
-- This script checks both onboarding tables, their structure, data, and usage
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Tables: EmployeeIntake_v1, Employee_Onboarding_Intake
--
-- Created: December 2025
-- ============================================================================

-- ============================================================================
-- QUERY 1: Check if EmployeeIntake_v1 exists
-- ============================================================================
SELECT 
  table_name,
  table_type,
  creation_time,
  last_modified_time,
  row_count,
  size_bytes,
  num_rows,
  description
FROM `test-imagine-web.Vyro_Business_Paradox.INFORMATION_SCHEMA.TABLES`
WHERE table_name = 'EmployeeIntake_v1'
ORDER BY creation_time DESC;

-- ============================================================================
-- QUERY 2: Check if Employee_Onboarding_Intake exists
-- ============================================================================
SELECT 
  table_name,
  table_type,
  creation_time,
  last_modified_time,
  row_count,
  size_bytes,
  num_rows,
  description
FROM `test-imagine-web.Vyro_Business_Paradox.INFORMATION_SCHEMA.TABLES`
WHERE table_name = 'Employee_Onboarding_Intake'
ORDER BY creation_time DESC;

-- ============================================================================
-- QUERY 3: Get EmployeeIntake_v1 schema (columns and data types)
-- ============================================================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM `test-imagine-web.Vyro_Business_Paradox.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'EmployeeIntake_v1'
ORDER BY ordinal_position;

-- ============================================================================
-- QUERY 4: Get Employee_Onboarding_Intake schema (columns and data types)
-- ============================================================================
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM `test-imagine-web.Vyro_Business_Paradox.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'Employee_Onboarding_Intake'
ORDER BY ordinal_position;

-- ============================================================================
-- QUERY 5: EmployeeIntake_v1 statistics and sample data
-- ============================================================================
-- Run this only if EmployeeIntake_v1 exists
SELECT 
  COUNT(*) as total_rows,
  COUNT(DISTINCT Submission_ID) as unique_submissions,
  COUNT(DISTINCT Employee_ID) as unique_employees,
  COUNTIF(Status = 'pending') as pending_count,
  COUNTIF(Status = 'approved') as approved_count,
  COUNTIF(Status IS NULL) as null_status_count
FROM `test-imagine-web.Vyro_Business_Paradox.EmployeeIntake_v1`;

-- ============================================================================
-- QUERY 6: EmployeeIntake_v1 sample data (first 5 rows)
-- ============================================================================
-- Run this only if EmployeeIntake_v1 exists
SELECT *
FROM `test-imagine-web.Vyro_Business_Paradox.EmployeeIntake_v1`
ORDER BY Created_At DESC
LIMIT 5;

-- ============================================================================
-- QUERY 7: EmployeeIntake_v1 status breakdown
-- ============================================================================
-- Run this only if EmployeeIntake_v1 exists
SELECT 
  Status,
  COUNT(*) as count,
  COUNT(DISTINCT Submission_ID) as unique_submissions,
  MIN(Created_At) as earliest,
  MAX(Created_At) as latest
FROM `test-imagine-web.Vyro_Business_Paradox.EmployeeIntake_v1`
GROUP BY Status
ORDER BY count DESC;

-- ============================================================================
-- QUERY 8: Employee_Onboarding_Intake statistics and sample data
-- ============================================================================
-- Run this only if Employee_Onboarding_Intake exists
SELECT 
  COUNT(*) as total_rows,
  COUNTIF(Status = 'pending') as pending_count,
  COUNTIF(Status = 'approved') as approved_count
FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Onboarding_Intake`;

-- ============================================================================
-- QUERY 9: Employee_Onboarding_Intake sample data (first 5 rows)
-- ============================================================================
-- Run this only if Employee_Onboarding_Intake exists
SELECT *
FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Onboarding_Intake`
ORDER BY Created_At DESC
LIMIT 5;

-- ============================================================================
-- QUERY 10: Compare schemas side by side
-- ============================================================================
SELECT 
  'EmployeeIntake_v1' as table_name,
  column_name,
  data_type,
  is_nullable
FROM `test-imagine-web.Vyro_Business_Paradox.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'EmployeeIntake_v1'

UNION ALL

SELECT 
  'Employee_Onboarding_Intake' as table_name,
  column_name,
  data_type,
  is_nullable
FROM `test-imagine-web.Vyro_Business_Paradox.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'Employee_Onboarding_Intake'

ORDER BY table_name, column_name;

-- ============================================================================
-- QUERY 11: Check for pending requests in EmployeeIntake_v1
-- ============================================================================
-- This is what dashboard.ts is trying to query
-- Run this only if EmployeeIntake_v1 exists
SELECT 
  COUNT(*) as pending_onboarding_requests
FROM `test-imagine-web.Vyro_Business_Paradox.EmployeeIntake_v1`
WHERE Status = 'pending';

-- ============================================================================
-- QUERY 12: Detailed view of pending requests in EmployeeIntake_v1
-- ============================================================================
-- Run this only if EmployeeIntake_v1 exists
SELECT 
  Submission_ID,
  Status,
  Employee_ID,
  JSON_EXTRACT_SCALAR(Payload, '$.Full_Name') as Full_Name,
  JSON_EXTRACT_SCALAR(Payload, '$.Official_Email') as Official_Email,
  JSON_EXTRACT_SCALAR(Payload, '$.Designation') as Designation,
  JSON_EXTRACT_SCALAR(Payload, '$.Department') as Department,
  Created_At,
  Updated_At,
  Approved_By,
  Slack_Channel
FROM `test-imagine-web.Vyro_Business_Paradox.EmployeeIntake_v1`
WHERE Status = 'pending'
ORDER BY Created_At DESC;

-- ============================================================================
-- USAGE SUMMARY (Based on Code Analysis)
-- ============================================================================
-- 
-- EmployeeIntake_v1:
--   - Used by: employee-management-app/src/lib/onboarding.ts
--   - Environment Variable: BQ_INTAKE_TABLE (default: "EmployeeIntake_v1")
--   - Purpose: Stores onboarding form submissions
--   - Schema: Submission_ID, Status, Payload (JSON), Slack_TS, Slack_Channel, 
--             Approved_By, Employee_ID, Created_At, Updated_At
--   - Status values: "pending", "approved", etc.
--   - Created automatically by code if it doesn't exist
--   - Functions: createOnboardingSubmission(), getPendingSubmissions(), etc.
--
-- Employee_Onboarding_Intake:
--   - Used by: employee-management-app/src/lib/dashboard.ts
--   - Environment Variable: BQ_ONBOARDING_TABLE (default: "Employee_Onboarding_Intake")
--   - Purpose: Dashboard tries to count pending onboarding requests
--   - Query: SELECT COUNT(*) WHERE Status = 'pending'
--   - Status: Table does NOT exist (causes error, handled gracefully)
--
-- RECOMMENDATION:
--   - Update dashboard.ts to use BQ_INTAKE_TABLE instead of BQ_ONBOARDING_TABLE
--   - This will make dashboard use the same table as onboarding system
--   - Or create Employee_Onboarding_Intake table if you need separate tracking
--
-- ============================================================================
