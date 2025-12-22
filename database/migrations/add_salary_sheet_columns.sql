-- ============================================================================
-- Add Missing Columns to Employee_Salaries Table for Enhanced Salary Sheets
-- ============================================================================
-- This migration adds all columns needed to match CSV structure and support
-- the enhanced salary sheets functionality
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Table: Employee_Salaries
-- ============================================================================

-- Add columns from USD/PKR CSV files
ALTER TABLE `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries`
ADD COLUMN IF NOT EXISTS Month_Key STRING OPTIONS(description="Composite key like 'Jan5184ameer hamza'"),
ADD COLUMN IF NOT EXISTS Key STRING OPTIONS(description="Employee key like '5184ameer hamza'"),
ADD COLUMN IF NOT EXISTS Status STRING OPTIONS(description="Employee status (1 for active, empty for inactive)"),
ADD COLUMN IF NOT EXISTS Email STRING OPTIONS(description="Employee email (denormalized from Employees)"),
ADD COLUMN IF NOT EXISTS Date_of_Joining DATE OPTIONS(description="Date of joining (denormalized)"),
ADD COLUMN IF NOT EXISTS Date_of_Leaving DATE OPTIONS(description="Date of leaving (denormalized)"),
ADD COLUMN IF NOT EXISTS Last_Month_Salary NUMERIC OPTIONS(description="Previous month's gross salary"),
ADD COLUMN IF NOT EXISTS New_Addition_Increment_Decrement NUMERIC OPTIONS(description="Increment amount for this month"),
ADD COLUMN IF NOT EXISTS Date_of_Increment_Decrement DATE OPTIONS(description="Effective date of increment/decrement"),
ADD COLUMN IF NOT EXISTS Payable_from_Last_Month NUMERIC OPTIONS(description="Amount payable from previous month"),
ADD COLUMN IF NOT EXISTS Revised_with_OPD NUMERIC OPTIONS(description="Regular Pay + 21 for USD (if not in probation) - calculated field"),
ADD COLUMN IF NOT EXISTS Salary_Status STRING OPTIONS(description="Salary release status: 'Released' or 'HOLD'"),
ADD COLUMN IF NOT EXISTS PaySlip_Status STRING OPTIONS(description="Payslip status: 'Sent' or 'Not Sent'"),
ADD COLUMN IF NOT EXISTS Month STRING OPTIONS(description="Month abbreviation (Jan, Feb, etc.) for display");
