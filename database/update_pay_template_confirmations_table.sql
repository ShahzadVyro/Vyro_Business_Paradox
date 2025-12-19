-- Add approval columns to Pay_Template_Confirmations table
-- BigQuery requires separate statements for columns with default values

-- Step 1: Add columns without defaults
ALTER TABLE `test-imagine-web.Vyro_Business_Paradox.Pay_Template_Confirmations`
ADD COLUMN IF NOT EXISTS Approved BOOL,
ADD COLUMN IF NOT EXISTS Approved_At TIMESTAMP,
ADD COLUMN IF NOT EXISTS Approved_By STRING;

-- Step 2: Set default value for Approved column
ALTER TABLE `test-imagine-web.Vyro_Business_Paradox.Pay_Template_Confirmations`
ALTER COLUMN Approved SET DEFAULT FALSE;

-- Step 3: Update existing rows to set Approved = FALSE
UPDATE `test-imagine-web.Vyro_Business_Paradox.Pay_Template_Confirmations`
SET Approved = FALSE
WHERE Approved IS NULL;
