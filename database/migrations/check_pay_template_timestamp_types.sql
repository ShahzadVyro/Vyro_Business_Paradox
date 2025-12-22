-- ============================================================================
-- DIAGNOSTIC QUERY: Check Pay Template Table Column Types
-- ============================================================================
-- This query checks the actual data types of timestamp columns in Pay_Template tables
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
  table_name IN ('Pay_Template_Increments', 'Pay_Template_Confirmations', 'Pay_Template_New_Hires', 'Pay_Template_Leavers')
  AND column_name IN ('Created_At', 'Updated_At', 'Approved_At')
ORDER BY
  table_name, column_name;

-- Expected result if tables are correct:
-- All data_type values should be 'TIMESTAMP'
--
-- If you see 'DATETIME', the tables need to be migrated to TIMESTAMP
