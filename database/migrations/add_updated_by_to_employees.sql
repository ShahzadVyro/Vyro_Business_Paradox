-- ============================================================================
-- Add Updated_By Column to Employees Table
-- ============================================================================
-- This migration adds the missing Updated_By column to the Employees table.
-- The column is used to track who last updated an employee record.
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Table: Employees
-- ============================================================================

-- Add Updated_By column if it doesn't exist
ALTER TABLE `test-imagine-web.Vyro_Business_Paradox.Employees`
ADD COLUMN IF NOT EXISTS Updated_By STRING OPTIONS(description="User/system that last updated record");

-- Verify the column was added
-- Run this query to check:
-- SELECT column_name, data_type, is_nullable
-- FROM `test-imagine-web.Vyro_Business_Paradox.INFORMATION_SCHEMA.COLUMNS`
-- WHERE table_name = 'Employees' AND column_name = 'Updated_By';
