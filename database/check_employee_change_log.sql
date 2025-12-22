-- ============================================================================
-- Check if EmployeeChangeLog Table Exists
-- ============================================================================
-- This script checks if EmployeeChangeLog table exists in BigQuery
-- and provides information about its structure and data
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Table: EmployeeChangeLog (if it exists)
--
-- Created: December 2025
-- ============================================================================

-- ============================================================================
-- QUERY 1: Check if table exists and get basic info
-- ============================================================================
-- Run this query first to see if the table exists
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
WHERE table_name = 'EmployeeChangeLog'
ORDER BY creation_time DESC;

-- ============================================================================
-- QUERY 2: Get table schema (columns and data types)
-- ============================================================================
-- Run this if the table exists to see its structure
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default,
  description
FROM `test-imagine-web.Vyro_Business_Paradox.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'EmployeeChangeLog'
ORDER BY ordinal_position;

-- ============================================================================
-- QUERY 3: Get row count and sample data
-- ============================================================================
-- Run this if the table exists to see sample data
SELECT 
  COUNT(*) as total_rows,
  COUNT(DISTINCT Employee_ID) as unique_employees
FROM `test-imagine-web.Vyro_Business_Paradox.EmployeeChangeLog`
LIMIT 1;

-- ============================================================================
-- QUERY 4: Sample data (first 10 rows)
-- ============================================================================
-- Run this to see what data is stored in the table
SELECT *
FROM `test-imagine-web.Vyro_Business_Paradox.EmployeeChangeLog`
ORDER BY Updated_Date DESC, Created_At DESC
LIMIT 10;

-- ============================================================================
-- QUERY 5: Check for rejoin/lifecycle related columns
-- ============================================================================
-- Run this to see if there are any columns related to rejoining or lifecycle
SELECT 
  column_name,
  data_type,
  description
FROM `test-imagine-web.Vyro_Business_Paradox.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'EmployeeChangeLog'
  AND (
    LOWER(column_name) LIKE '%rejoin%' 
    OR LOWER(column_name) LIKE '%lifecycle%'
    OR LOWER(column_name) LIKE '%status%'
    OR LOWER(column_name) LIKE '%change%'
    OR LOWER(column_name) LIKE '%history%'
  )
ORDER BY ordinal_position;

-- ============================================================================
-- QUERY 6: Compare with Employee_Field_Updates structure
-- ============================================================================
-- Run this to compare the two tables side by side
SELECT 
  'EmployeeChangeLog' as table_name,
  column_name,
  data_type,
  is_nullable
FROM `test-imagine-web.Vyro_Business_Paradox.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'EmployeeChangeLog'

UNION ALL

SELECT 
  'Employee_Field_Updates' as table_name,
  column_name,
  data_type,
  is_nullable
FROM `test-imagine-web.Vyro_Business_Paradox.INFORMATION_SCHEMA.COLUMNS`
WHERE table_name = 'Employee_Field_Updates'

ORDER BY table_name, column_name;

-- ============================================================================
-- QUERY 7: Check for employees with rejoin information in EmployeeChangeLog
-- ============================================================================
-- Run this if the table exists to see if it tracks rejoins
SELECT 
  Employee_ID,
  COUNT(*) as change_count,
  MIN(Updated_Date) as first_change,
  MAX(Updated_Date) as last_change,
  COUNT(DISTINCT Status) as status_changes
FROM `test-imagine-web.Vyro_Business_Paradox.EmployeeChangeLog`
WHERE Employee_ID IS NOT NULL
GROUP BY Employee_ID
HAVING status_changes > 1 OR change_count > 5
ORDER BY change_count DESC
LIMIT 20;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. Run queries 1-2 first to check if table exists
-- 2. If table exists, run queries 3-4 to see data
-- 3. Query 5 checks for lifecycle-related columns
-- 4. Query 6 compares with Employee_Field_Updates
-- 5. Query 7 looks for potential rejoin cases
--
-- If the table doesn't exist, you'll get an error - that's expected!
-- In that case, use Employee_Field_Updates instead (which is what the code uses)
