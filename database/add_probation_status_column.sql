-- Add Probation_Status column to Employees table
ALTER TABLE `test-imagine-web.Vyro_Business_Paradox.Employees`
ADD COLUMN IF NOT EXISTS Probation_Status STRING OPTIONS(description="Probation status: Probation, Permanent, or NULL");
