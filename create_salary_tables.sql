-- ============================================================================
-- BigQuery Schema for Salary Tables
-- ============================================================================
-- This creates two salary tables:
-- 1. Combined-USD_2025 - USD salary data
-- 2. Combined-PKR_2025 - PKR salary data
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
--
-- Created: January 2025
-- ============================================================================

-- ============================================================================
-- USD SALARIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.Combined-USD_2025` (
    Month_Key STRING OPTIONS(description="Month key identifier"),
    Key STRING OPTIONS(description="Unique key for the record"),
    Status STRING OPTIONS(description="Employee status"),
    Employee_ID STRING OPTIONS(description="Employee ID"),
    Employee_Name STRING OPTIONS(description="Employee full name"),
    Designation STRING OPTIONS(description="Job designation"),
    Email STRING OPTIONS(description="Email address"),
    Date_of_Joining DATE OPTIONS(description="Date of joining"),
    Date_of_Leaving DATE OPTIONS(description="Date of leaving"),
    Worked_Days NUMERIC OPTIONS(description="Number of days worked in the month"),
    Dec_Salary NUMERIC OPTIONS(description="December salary amount"),
    Increment_Decrement NUMERIC OPTIONS(description="Increment or decrement amount"),
    Date_of_Increment DATE OPTIONS(description="Date of increment/decrement"),
    Payable_from_Last_Month NUMERIC OPTIONS(description="Amount payable from last month"),
    Regular_Pay NUMERIC OPTIONS(description="Regular pay amount"),
    Prorated_Pay NUMERIC OPTIONS(description="Prorated pay amount"),
    Performance_Bonus NUMERIC OPTIONS(description="Performance bonus amount"),
    Paid_Overtime NUMERIC OPTIONS(description="Paid overtime amount"),
    Reimbursements NUMERIC OPTIONS(description="Reimbursements amount"),
    Other NUMERIC OPTIONS(description="Other adjustments"),
    Gross_Income NUMERIC OPTIONS(description="Gross income amount"),
    Unpaid_Leaves NUMERIC OPTIONS(description="Number of unpaid leaves"),
    Deductions NUMERIC OPTIONS(description="Total deductions"),
    Net_Income NUMERIC OPTIONS(description="Net income amount"),
    Comments STRING OPTIONS(description="Comments"),
    Internal_Comments STRING OPTIONS(description="Internal comments"),
    Currency STRING OPTIONS(description="Currency code (USD)"),
    Month STRING OPTIONS(description="Month name"),
    Loaded_At TIMESTAMP OPTIONS(description="Timestamp when record was loaded")
)
CLUSTER BY Month, Employee_ID, Currency
OPTIONS(
    description="USD salary data for 2025",
    labels=[("subject", "payroll"), ("currency", "usd"), ("year", "2025")]
);

-- ============================================================================
-- PKR SALARIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.Combined-PKR_2025` (
    Month_Key STRING OPTIONS(description="Month key identifier"),
    Key STRING OPTIONS(description="Unique key for the record"),
    Status STRING OPTIONS(description="Employee status"),
    Employee_ID STRING OPTIONS(description="Employee ID"),
    Employee_Name STRING OPTIONS(description="Employee full name"),
    Designation STRING OPTIONS(description="Job designation"),
    Email STRING OPTIONS(description="Email address"),
    Date_of_Joining DATE OPTIONS(description="Date of joining"),
    Date_of_Leaving DATE OPTIONS(description="Date of leaving"),
    Worked_Days NUMERIC OPTIONS(description="Number of days worked in the month"),
    Last_Months_Salary NUMERIC OPTIONS(description="Last month's salary amount"),
    Increment_New_Addition NUMERIC OPTIONS(description="Increment or new addition amount"),
    Date_of_Increment DATE OPTIONS(description="Date of increment"),
    Payable_from_Last_Next_Month NUMERIC OPTIONS(description="Amount payable from last/next month"),
    Regular_Pay NUMERIC OPTIONS(description="Regular pay amount"),
    Prorated_Pay NUMERIC OPTIONS(description="Prorated pay amount"),
    Prorated_Base_Pay NUMERIC OPTIONS(description="Prorated base pay amount"),
    Prorated_Medical_Allowance NUMERIC OPTIONS(description="Prorated medical allowance"),
    Prorated_Transport_Allowance NUMERIC OPTIONS(description="Prorated transport allowance"),
    Prorated_Inflation_Allowance NUMERIC OPTIONS(description="Prorated inflation allowance"),
    Performance_Bonus NUMERIC OPTIONS(description="Performance bonus amount"),
    Paid_Overtime NUMERIC OPTIONS(description="Paid overtime amount"),
    Reimbursements NUMERIC OPTIONS(description="Reimbursements amount"),
    Other NUMERIC OPTIONS(description="Other adjustments"),
    Taxable_Income NUMERIC OPTIONS(description="Taxable income amount"),
    Gross_Income NUMERIC OPTIONS(description="Gross income amount"),
    Unpaid_Leaves NUMERIC OPTIONS(description="Number of unpaid leaves/days"),
    Tax_Deduction NUMERIC OPTIONS(description="Tax deduction amount"),
    EOBI NUMERIC OPTIONS(description="EOBI contribution amount"),
    Loan_Deduction NUMERIC OPTIONS(description="Loan deduction amount"),
    Recoveries NUMERIC OPTIONS(description="Recoveries amount"),
    Deductions NUMERIC OPTIONS(description="Total deductions"),
    Net_Income NUMERIC OPTIONS(description="Net income amount"),
    Comments STRING OPTIONS(description="Comments"),
    Currency STRING OPTIONS(description="Currency code (PKR)"),
    Month STRING OPTIONS(description="Month name"),
    Loaded_At TIMESTAMP OPTIONS(description="Timestamp when record was loaded")
)
CLUSTER BY Month, Employee_ID, Currency
OPTIONS(
    description="PKR salary data for 2025",
    labels=[("subject", "payroll"), ("currency", "pkr"), ("year", "2025")]
);

-- ============================================================================
-- CREATE VIEWS FOR EASIER QUERYING
-- ============================================================================

-- View combining both USD and PKR salaries
CREATE OR REPLACE VIEW `test-imagine-web.Vyro_Business_Paradox.Salaries_Combined_2025` AS
SELECT 
    'USD' as Currency_Type,
    Month_Key,
    Key,
    Status,
    Employee_ID,
    Employee_Name,
    Designation,
    Email,
    Date_of_Joining,
    Date_of_Leaving,
    Worked_Days,
    Regular_Pay,
    Prorated_Pay,
    Performance_Bonus,
    Paid_Overtime,
    Reimbursements,
    Other,
    Gross_Income,
    Unpaid_Leaves,
    Deductions,
    Net_Income,
    Comments,
    Month,
    Loaded_At
FROM `test-imagine-web.Vyro_Business_Paradox.Combined-USD_2025`

UNION ALL

SELECT 
    'PKR' as Currency_Type,
    Month_Key,
    Key,
    Status,
    Employee_ID,
    Employee_Name,
    Designation,
    Email,
    Date_of_Joining,
    Date_of_Leaving,
    Worked_Days,
    Regular_Pay,
    Prorated_Pay,
    Performance_Bonus,
    Paid_Overtime,
    Reimbursements,
    Other,
    Gross_Income,
    Unpaid_Leaves,
    Deductions,
    Net_Income,
    Comments,
    Month,
    Loaded_At
FROM `test-imagine-web.Vyro_Business_Paradox.Combined-PKR_2025`;

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get all USD salaries for a specific month
-- SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.Combined-USD_2025`
-- WHERE Month = 'Jan'
-- ORDER BY Employee_Name;

-- Get all PKR salaries for a specific employee
-- SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.Combined-PKR_2025`
-- WHERE Employee_ID = '5184'
-- ORDER BY Month;

-- Get combined salary summary by month
-- SELECT 
--     Month,
--     Currency_Type,
--     COUNT(*) as Employee_Count,
--     SUM(Gross_Income) as Total_Gross_Income,
--     SUM(Net_Income) as Total_Net_Income
-- FROM `test-imagine-web.Vyro_Business_Paradox.Salaries_Combined_2025`
-- GROUP BY Month, Currency_Type
-- ORDER BY Month, Currency_Type;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. Tables are clustered by Month, Employee_ID, and Currency for better query performance
-- 2. Both tables include a Loaded_At timestamp for audit purposes
-- 3. The combined view allows querying both currencies together
-- 4. All numeric fields are stored as NUMERIC type for precision
-- 5. Date fields are stored as DATE type
-- ============================================================================







