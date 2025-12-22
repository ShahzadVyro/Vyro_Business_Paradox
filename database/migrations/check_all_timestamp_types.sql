-- ============================================================================
-- COMPREHENSIVE DIAGNOSTIC QUERY: Check All Table Column Types
-- ============================================================================
-- This query checks the actual data types of timestamp columns in ALL tables
-- that are used by Pay Template operations
-- ============================================================================

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM
  `test-imagine-web.Vyro_Business_Paradox.INFORMATION_SCHEMA.COLUMNS`
WHERE
  table_name IN (
    'Pay_Template_Increments',
    'Pay_Template_Confirmations',
    'Pay_Template_New_Hires',
    'Pay_Template_Leavers',
    'Employees'  -- This table is updated when adding increments
  )
  AND column_name IN ('Created_At', 'Updated_At', 'Approved_At')
ORDER BY
  table_name, column_name;

-- Expected result if all tables are correct:
-- All data_type values should be 'TIMESTAMP'
--
-- If you see 'DATETIME' for any column, that table needs to be migrated to TIMESTAMP
--
-- Common issue: Employees.Updated_At might be DATETIME even though schema says TIMESTAMP
