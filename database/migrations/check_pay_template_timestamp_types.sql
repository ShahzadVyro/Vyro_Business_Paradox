-- Diagnostic query to check actual column types in Pay Template tables
-- Run this in BigQuery to see if columns are DATETIME or TIMESTAMP

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM
  `test-imagine-web.Vyro_Business_Paradox.INFORMATION_SCHEMA.COLUMNS`
WHERE
  table_name IN ('Pay_Template_Increments', 'Pay_Template_Confirmations', 'Pay_Template_New_Hires', 'Pay_Template_Leavers')
  AND column_name IN ('Created_At', 'Updated_At', 'Approved_At')
ORDER BY
  table_name, column_name;
