-- Add Probation_Period_Months and Probation_Start_Date columns to Employees table
-- These columns are needed for automatic probation period calculation

-- Add Probation_Period_Months column (INT64)
ALTER TABLE `test-imagine-web.Vyro_Business_Paradox.Employees`
ADD COLUMN IF NOT EXISTS Probation_Period_Months INT64 OPTIONS(description="Length of probation period in months (default: 3)");

-- Add Probation_Start_Date column (DATE)
ALTER TABLE `test-imagine-web.Vyro_Business_Paradox.Employees`
ADD COLUMN IF NOT EXISTS Probation_Start_Date DATE OPTIONS(description="Probation start date (usually same as Joining_Date)");
