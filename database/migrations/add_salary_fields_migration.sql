-- ============================================================================
-- Migration: Add Missing Salary Fields to Employee_Salaries Table
-- ============================================================================
-- Adds fields required for enhanced salary sheets matching CSV structure
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Table: Employee_Salaries
-- ============================================================================

-- Add Month_Key field (composite key like "Jan5184ameer hamza")
ALTER TABLE `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries`
ADD COLUMN IF NOT EXISTS Month_Key STRING OPTIONS(description="Composite key: Month abbreviation + Employee_ID + Employee name (lowercase)");

-- Add Key field (employee key like "5184ameer hamza")
ALTER TABLE `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries`
ADD COLUMN IF NOT EXISTS Key STRING OPTIONS(description="Employee key: Employee_ID + Employee name (lowercase)");

-- Add Status field (1 for active, empty for inactive)
ALTER TABLE `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries`
ADD COLUMN IF NOT EXISTS Status STRING OPTIONS(description="Employee status: '1' for active, empty for inactive");

-- Add Email field (denormalized from Employees)
ALTER TABLE `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries`
ADD COLUMN IF NOT EXISTS Email STRING OPTIONS(description="Employee email (denormalized from Employees table)");

-- Add Date_of_Joining field (denormalized from Employees)
ALTER TABLE `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries`
ADD COLUMN IF NOT EXISTS Date_of_Joining DATE OPTIONS(description="Date of joining (denormalized from Employees table)");

-- Add Date_of_Leaving field (denormalized from Employees)
ALTER TABLE `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries`
ADD COLUMN IF NOT EXISTS Date_of_Leaving DATE OPTIONS(description="Date of leaving (denormalized from Employees table)");

-- Add Last_Month_Salary field (previous month's gross salary)
ALTER TABLE `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries`
ADD COLUMN IF NOT EXISTS Last_Month_Salary NUMERIC OPTIONS(description="Previous month's gross salary (USD: 'Dec Salary', PKR: 'Last Months's Salary')");

-- Add New_Addition_Increment_Decrement field (increment amount for this month)
ALTER TABLE `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries`
ADD COLUMN IF NOT EXISTS New_Addition_Increment_Decrement NUMERIC OPTIONS(description="Increment amount for this month");

-- Add Date_of_Increment_Decrement field (effective date of increment/decrement)
ALTER TABLE `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries`
ADD COLUMN IF NOT EXISTS Date_of_Increment_Decrement DATE OPTIONS(description="Effective date of increment/decrement");

-- Add Payable_from_Last_Month field (amount payable from previous month)
ALTER TABLE `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries`
ADD COLUMN IF NOT EXISTS Payable_from_Last_Month NUMERIC OPTIONS(description="Amount payable from previous month/advance");

-- Add Revised_with_OPD field (Regular Pay + 21 for USD if not in probation)
ALTER TABLE `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries`
ADD COLUMN IF NOT EXISTS Revised_with_OPD NUMERIC OPTIONS(description="Regular Pay + 21 for USD (if not in probation) - calculated field");

-- Add Salary_Status field ("Released" or "HOLD")
ALTER TABLE `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries`
ADD COLUMN IF NOT EXISTS Salary_Status STRING OPTIONS(description="Salary status: 'Released' or 'HOLD' (from Status column mapping)");

-- Add PaySlip_Status field ("Sent" or "Not Sent")
ALTER TABLE `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries`
ADD COLUMN IF NOT EXISTS PaySlip_Status STRING OPTIONS(description="Payslip status: 'Sent' or 'Not Sent' (default 'Not Sent')");

-- Add Month field (month abbreviation like "Jan", "Feb", etc.)
ALTER TABLE `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries`
ADD COLUMN IF NOT EXISTS Month STRING OPTIONS(description="Month abbreviation (Jan, Feb, etc.) for display");
