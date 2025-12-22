-- ============================================================================
-- Employee OPD Benefits Fact Table
-- ============================================================================
-- Tracks Out Patient Department (OPD) benefits for PKR salaried employees
-- OPD benefit: 6000 PKR per month, accumulates if not claimed
-- 
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Table: Employee_OPD_Benefits
-- ============================================================================

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.Employee_OPD_Benefits` (
    OPD_ID INT64 NOT NULL OPTIONS(description="Primary key, auto-generated"),
    Employee_ID INT64 NOT NULL OPTIONS(description="Foreign key to Employees table"),
    Benefit_Month DATE NOT NULL OPTIONS(description="Month for which benefit was accrued (first day of month)"),
    Contribution_Amount NUMERIC OPTIONS(description="Amount contributed for this month (typically 6000 PKR, may be prorated)"),
    Claimed_Amount NUMERIC OPTIONS(description="Amount claimed in this month"),
    Balance NUMERIC OPTIONS(description="Running balance after this month (accumulated - claimed)"),
    Currency STRING OPTIONS(description="Currency (should be 'PKR' only)"),
    Is_Active BOOL OPTIONS(description="Whether employee is eligible for OPD (PKR salaried)"),
    Comments STRING OPTIONS(description="Notes about claims, balance, or special cases"),
    Created_At TIMESTAMP OPTIONS(description="Record creation timestamp"),
    Updated_At TIMESTAMP OPTIONS(description="Last update timestamp")
)
PARTITION BY Benefit_Month
CLUSTER BY Employee_ID, Currency
OPTIONS(
    description="Tracks OPD benefits contributions and claims for PKR salaried employees"
);

-- Create index-like clustering for efficient queries
-- Note: BigQuery uses clustering instead of indexes


