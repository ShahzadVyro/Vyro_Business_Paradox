-- ============================================================================
-- Salary Status Table
-- ============================================================================
-- Separate table for tracking salary release and payslip status
-- This allows for better tracking and audit trail of salary processing
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Table: Salary_Status
--
-- Created: January 2025
-- ============================================================================

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.Salary_Status` (
    Status_ID INT64 NOT NULL OPTIONS(description="Unique status record identifier"),
    Salary_ID INT64 NOT NULL OPTIONS(description="FK to Employee_Salaries.Salary_ID"),
    Employee_ID INT64 NOT NULL OPTIONS(description="Employee ID (FK to Employees)"),
    Payroll_Month DATE NOT NULL OPTIONS(description="Payroll month (first day of month)"),
    Currency STRING NOT NULL OPTIONS(description="Currency code (USD/PKR)"),
    Salary_Status STRING OPTIONS(description="Salary release status: 'Released' or 'HOLD'"),
    PaySlip_Status STRING OPTIONS(description="Payslip status: 'Sent' or 'Not Sent'"),
    Updated_At TIMESTAMP OPTIONS(description="Timestamp when status was last updated"),
    Updated_By STRING OPTIONS(description="User/system that last updated the status")
)
PARTITION BY Payroll_Month
CLUSTER BY Employee_ID, Currency
OPTIONS(
    description="Salary release and payslip status tracking table",
    labels=[("subject", "payroll"), ("version", "1")]
);

-- Create index on Salary_ID for fast lookups
-- Note: BigQuery doesn't support explicit indexes, but clustering helps
