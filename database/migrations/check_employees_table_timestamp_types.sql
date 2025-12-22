-- ============================================================================
-- DIAGNOSTIC QUERY: Check Employees Table Column Types
-- ============================================================================
-- This query checks the actual data types of timestamp columns in the Employees table
-- Run this in BigQuery to verify if columns are DATETIME or TIMESTAMP
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
  table_name = 'Employees'
  AND column_name IN ('Created_At', 'Updated_At')
ORDER BY
  column_name;

-- Expected result if table is correct:
-- All data_type values should be 'TIMESTAMP'
--
-- If you see 'DATETIME', the Employees table needs to be migrated to TIMESTAMP
