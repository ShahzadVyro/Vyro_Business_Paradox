-- ============================================================================
-- Employee Tax Calculations Fact Table
-- ============================================================================
-- Tracks withholding tax and other tax calculations for each payroll month
-- 
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Table: Employee_Tax_Calculations
-- ============================================================================

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.Employee_Tax_Calculations` (
    Tax_ID INT64 NOT NULL OPTIONS(description="Primary key, auto-generated"),
    Employee_ID INT64 NOT NULL OPTIONS(description="Foreign key to Employees table"),
    Payroll_Month DATE NOT NULL OPTIONS(description="Month for which tax was calculated (first day of month)"),
    Taxable_Income NUMERIC OPTIONS(description="Taxable income amount"),
    Tax_Rate NUMERIC OPTIONS(description="Tax rate applied (percentage or fixed rate)"),
    Tax_Amount NUMERIC OPTIONS(description="Calculated tax amount"),
    Tax_Type STRING OPTIONS(description="Type of tax: Withholding, Income, Other"),
    Tax_Bracket STRING OPTIONS(description="Tax bracket applied"),
    Calculated_At TIMESTAMP OPTIONS(description="When tax was calculated"),
    Comments STRING OPTIONS(description="Notes about tax calculation"),
    Created_At TIMESTAMP OPTIONS(description="Record creation timestamp")
)
PARTITION BY Payroll_Month
CLUSTER BY Employee_ID, Tax_Type
OPTIONS(
    description="Tracks tax calculations for each employee per payroll month"
);


