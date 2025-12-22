-- ============================================================================
-- Employee Salaries Fact Table
-- ============================================================================
-- Normalized salary fact table for monthly salary transactions
-- References Employees dimension table (no denormalized employee data)
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Table: Employee_Salaries
--
-- Created: January 2025
-- ============================================================================

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries` (
    Salary_ID INT64 NOT NULL OPTIONS(description="Unique salary record identifier"),
    Employee_ID INT64 NOT NULL OPTIONS(description="Employee ID (FK to Employees)"),
    Payroll_Month DATE NOT NULL OPTIONS(description="Payroll month (first day of month)"),
    Currency STRING NOT NULL OPTIONS(description="Currency code (USD/PKR)"),
    
    -- Salary Components
    Regular_Pay NUMERIC OPTIONS(description="Regular pay amount"),
    Prorated_Pay NUMERIC OPTIONS(description="Prorated pay amount"),
    Prorated_Base_Pay NUMERIC OPTIONS(description="Prorated base pay (PKR only)"),
    Prorated_Medical_Allowance NUMERIC OPTIONS(description="Prorated medical allowance (PKR only)"),
    Prorated_Transport_Allowance NUMERIC OPTIONS(description="Prorated transport allowance (PKR only)"),
    Prorated_Inflation_Allowance NUMERIC OPTIONS(description="Prorated inflation allowance (PKR only)"),
    Performance_Bonus NUMERIC OPTIONS(description="Performance bonus amount"),
    Paid_Overtime NUMERIC OPTIONS(description="Paid overtime amount"),
    Reimbursements NUMERIC OPTIONS(description="Reimbursements amount"),
    Other NUMERIC OPTIONS(description="Other adjustments"),
    
    -- Income Calculations
    Taxable_Income NUMERIC OPTIONS(description="Taxable income (PKR only)"),
    Gross_Income NUMERIC OPTIONS(description="Gross income amount"),
    
    -- Deductions
    Unpaid_Leaves NUMERIC OPTIONS(description="Number of unpaid leaves/days"),
    Tax_Deduction NUMERIC OPTIONS(description="Tax deduction amount (PKR only)"),
    EOBI NUMERIC OPTIONS(description="EOBI contribution amount (PKR only)"),
    Loan_Deduction NUMERIC OPTIONS(description="Loan deduction amount (PKR only)"),
    Recoveries NUMERIC OPTIONS(description="Recoveries amount (PKR only)"),
    Deductions NUMERIC OPTIONS(description="Total deductions"),
    
    -- Final Amount
    Net_Income NUMERIC OPTIONS(description="Net income amount"),
    
    -- Additional Fields
    Worked_Days NUMERIC OPTIONS(description="Number of days worked in the month"),
    Comments STRING OPTIONS(description="Comments"),
    Internal_Comments STRING OPTIONS(description="Internal comments"),
    
    -- Employee State at Payroll (for historical accuracy)
    Designation_At_Payroll STRING OPTIONS(description="Designation at time of payroll"),
    Department_At_Payroll STRING OPTIONS(description="Department at time of payroll"),
    Bank_Account_At_Payroll STRING OPTIONS(description="Bank account number at time of payroll"),
    Bank_Name_At_Payroll STRING OPTIONS(description="Bank name at time of payroll"),
    Salary_Effective_Date DATE OPTIONS(description="Date when current salary became effective"),
    
    -- System Fields
    Loaded_At TIMESTAMP OPTIONS(description="Timestamp when record was loaded"),
    Created_At TIMESTAMP OPTIONS(description="Record creation timestamp")
)
PARTITION BY Payroll_Month
CLUSTER BY Employee_ID, Currency
OPTIONS(
    description="Monthly salary transactions - normalized fact table referencing Employees dimension",
    labels=[("subject", "payroll"), ("version", "1")]
);

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get employee salary history
-- SELECT 
--     e.Full_Name,
--     s.Payroll_Month,
--     s.Currency,
--     s.Gross_Income,
--     s.Net_Income
-- FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries` s
-- JOIN `test-imagine-web.Vyro_Business_Paradox.Employees` e ON s.Employee_ID = e.Employee_ID
-- WHERE s.Employee_ID = 5395
-- ORDER BY s.Payroll_Month DESC;

-- Monthly payroll summary
-- SELECT 
--     Payroll_Month,
--     Currency,
--     COUNT(DISTINCT Employee_ID) as Employee_Count,
--     SUM(Gross_Income) as Total_Gross_Income,
--     SUM(Net_Income) as Total_Net_Income
-- FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries`
-- GROUP BY Payroll_Month, Currency
-- ORDER BY Payroll_Month DESC, Currency;

