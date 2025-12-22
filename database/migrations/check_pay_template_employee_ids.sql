-- ============================================================================
-- DIAGNOSTIC SCRIPT: Check Employee_ID Data in Pay_Template Tables
-- ============================================================================
-- This script checks the current state of Employee_ID values in Pay_Template tables
-- to determine if they can be safely converted from STRING to INT64
-- ============================================================================

-- ============================================================================
-- QUERY 1: Check Pay_Template_Increments
-- ============================================================================
SELECT 
  'Pay_Template_Increments' as table_name,
  COUNT(*) as total_records,
  COUNT(Employee_ID) as records_with_employee_id,
  COUNT(*) - COUNT(Employee_ID) as records_with_null_employee_id,
  COUNT(DISTINCT Employee_ID) as distinct_employee_ids,
  -- Check if all Employee_IDs are numeric
  COUNT(CASE WHEN Employee_ID IS NOT NULL AND REGEXP_CONTAINS(Employee_ID, r'^[0-9]+$') THEN 1 END) as numeric_employee_ids,
  COUNT(CASE WHEN Employee_ID IS NOT NULL AND NOT REGEXP_CONTAINS(Employee_ID, r'^[0-9]+$') THEN 1 END) as non_numeric_employee_ids,
  -- Sample values
  ARRAY_AGG(Employee_ID LIMIT 10) as sample_employee_ids
FROM `test-imagine-web.Vyro_Business_Paradox.Pay_Template_Increments`;

-- ============================================================================
-- QUERY 2: Check Pay_Template_New_Hires
-- ============================================================================
SELECT 
  'Pay_Template_New_Hires' as table_name,
  COUNT(*) as total_records,
  COUNT(Employee_ID) as records_with_employee_id,
  COUNT(*) - COUNT(Employee_ID) as records_with_null_employee_id,
  COUNT(DISTINCT Employee_ID) as distinct_employee_ids,
  COUNT(CASE WHEN Employee_ID IS NOT NULL AND REGEXP_CONTAINS(Employee_ID, r'^[0-9]+$') THEN 1 END) as numeric_employee_ids,
  COUNT(CASE WHEN Employee_ID IS NOT NULL AND NOT REGEXP_CONTAINS(Employee_ID, r'^[0-9]+$') THEN 1 END) as non_numeric_employee_ids,
  ARRAY_AGG(Employee_ID LIMIT 10) as sample_employee_ids
FROM `test-imagine-web.Vyro_Business_Paradox.Pay_Template_New_Hires`;

-- ============================================================================
-- QUERY 3: Check Pay_Template_Leavers
-- ============================================================================
SELECT 
  'Pay_Template_Leavers' as table_name,
  COUNT(*) as total_records,
  COUNT(Employee_ID) as records_with_employee_id,
  COUNT(*) - COUNT(Employee_ID) as records_with_null_employee_id,
  COUNT(DISTINCT Employee_ID) as distinct_employee_ids,
  COUNT(CASE WHEN Employee_ID IS NOT NULL AND REGEXP_CONTAINS(Employee_ID, r'^[0-9]+$') THEN 1 END) as numeric_employee_ids,
  COUNT(CASE WHEN Employee_ID IS NOT NULL AND NOT REGEXP_CONTAINS(Employee_ID, r'^[0-9]+$') THEN 1 END) as non_numeric_employee_ids,
  ARRAY_AGG(Employee_ID LIMIT 10) as sample_employee_ids
FROM `test-imagine-web.Vyro_Business_Paradox.Pay_Template_Leavers`;

-- ============================================================================
-- QUERY 4: Check Pay_Template_Confirmations
-- ============================================================================
SELECT 
  'Pay_Template_Confirmations' as table_name,
  COUNT(*) as total_records,
  COUNT(Employee_ID) as records_with_employee_id,
  COUNT(*) - COUNT(Employee_ID) as records_with_null_employee_id,
  COUNT(DISTINCT Employee_ID) as distinct_employee_ids,
  COUNT(CASE WHEN Employee_ID IS NOT NULL AND REGEXP_CONTAINS(Employee_ID, r'^[0-9]+$') THEN 1 END) as numeric_employee_ids,
  COUNT(CASE WHEN Employee_ID IS NOT NULL AND NOT REGEXP_CONTAINS(Employee_ID, r'^[0-9]+$') THEN 1 END) as non_numeric_employee_ids,
  ARRAY_AGG(Employee_ID LIMIT 10) as sample_employee_ids
FROM `test-imagine-web.Vyro_Business_Paradox.Pay_Template_Confirmations`;

-- ============================================================================
-- QUERY 5: Check for non-numeric Employee_IDs (if any exist)
-- ============================================================================
-- Run this only if non_numeric_employee_ids > 0 in any table above

-- Non-numeric Employee_IDs in Pay_Template_Increments
SELECT 
  'Pay_Template_Increments' as table_name,
  Employee_ID,
  COUNT(*) as count
FROM `test-imagine-web.Vyro_Business_Paradox.Pay_Template_Increments`
WHERE Employee_ID IS NOT NULL 
  AND NOT REGEXP_CONTAINS(Employee_ID, r'^[0-9]+$')
GROUP BY Employee_ID;

-- Non-numeric Employee_IDs in Pay_Template_New_Hires
SELECT 
  'Pay_Template_New_Hires' as table_name,
  Employee_ID,
  COUNT(*) as count
FROM `test-imagine-web.Vyro_Business_Paradox.Pay_Template_New_Hires`
WHERE Employee_ID IS NOT NULL 
  AND NOT REGEXP_CONTAINS(Employee_ID, r'^[0-9]+$')
GROUP BY Employee_ID;

-- Non-numeric Employee_IDs in Pay_Template_Leavers
SELECT 
  'Pay_Template_Leavers' as table_name,
  Employee_ID,
  COUNT(*) as count
FROM `test-imagine-web.Vyro_Business_Paradox.Pay_Template_Leavers`
WHERE Employee_ID IS NOT NULL 
  AND NOT REGEXP_CONTAINS(Employee_ID, r'^[0-9]+$')
GROUP BY Employee_ID;

-- Non-numeric Employee_IDs in Pay_Template_Confirmations
SELECT 
  'Pay_Template_Confirmations' as table_name,
  Employee_ID,
  COUNT(*) as count
FROM `test-imagine-web.Vyro_Business_Paradox.Pay_Template_Confirmations`
WHERE Employee_ID IS NOT NULL 
  AND NOT REGEXP_CONTAINS(Employee_ID, r'^[0-9]+$')
GROUP BY Employee_ID;

-- ============================================================================
-- QUERY 6: Verify Employee_IDs exist in Employees table
-- ============================================================================
-- Check if Employee_IDs in Pay_Template tables match Employees table

SELECT 
  'Pay_Template_Increments' as table_name,
  COUNT(DISTINCT pt.Employee_ID) as pay_template_employee_ids,
  COUNT(DISTINCT CAST(pt.Employee_ID AS INT64)) as valid_numeric_ids,
  COUNT(DISTINCT e.Employee_ID) as matching_employees_table_ids,
  COUNT(DISTINCT pt.Employee_ID) - COUNT(DISTINCT e.Employee_ID) as orphaned_ids
FROM `test-imagine-web.Vyro_Business_Paradox.Pay_Template_Increments` pt
LEFT JOIN `test-imagine-web.Vyro_Business_Paradox.Employees` e
  ON CAST(pt.Employee_ID AS INT64) = e.Employee_ID
WHERE pt.Employee_ID IS NOT NULL;

-- ============================================================================
-- INTERPRETATION GUIDE
-- ============================================================================
-- 1. If numeric_employee_ids = records_with_employee_id for all tables:
--    → Safe to convert STRING to INT64
-- 2. If non_numeric_employee_ids > 0:
--    → Need to investigate and clean data before conversion
-- 3. If records_with_null_employee_id > 0:
--    → This is OK, NULL values will remain NULL after conversion
-- 4. If orphaned_ids > 0:
--    → Some Employee_IDs don't exist in Employees table (may need cleanup)
