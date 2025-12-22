-- ============================================================================
-- Employee EOBI Fact Table
-- ============================================================================
-- Normalized EOBI fact table for monthly EOBI contributions
-- References Employees dimension table (no denormalized employee data)
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Table: Employee_EOBI
--
-- Created: January 2025
-- ============================================================================

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.Employee_EOBI` (
    EOBI_ID INT64 NOT NULL OPTIONS(description="Unique EOBI record identifier"),
    Employee_ID INT64 NOT NULL OPTIONS(description="Employee ID (FK to Employees)"),
    Payroll_Month DATE NOT NULL OPTIONS(description="Payroll month (first day of month)"),
    
    -- EOBI Portal Fields
    EMP_AREA_CODE STRING OPTIONS(description="Employee area code"),
    EMP_REG_SERIAL_NO STRING OPTIONS(description="Employee registration serial number"),
    EMP_SUB_AREA_CODE STRING OPTIONS(description="Employee sub area code"),
    EMP_SUB_SERIAL_NO STRING OPTIONS(description="Employee sub serial number"),
    EOBI_NO STRING OPTIONS(description="EOBI number"),
    
    -- Dates
    DOB DATE OPTIONS(description="Date of birth"),
    DOJ DATE OPTIONS(description="Date of joining"),
    DOE DATE OPTIONS(description="Date of exit"),
    From_Date DATE OPTIONS(description="Period from date"),
    To_Date DATE OPTIONS(description="Period to date"),
    
    -- Work Details
    NO_OF_DAYS_WORKED NUMERIC OPTIONS(description="Number of days worked"),
    
    -- Contributions
    Employee_Contribution NUMERIC OPTIONS(description="Employee contribution amount"),
    Employer_Contribution NUMERIC OPTIONS(description="Employer contribution amount"),
    Total_EOBI NUMERIC OPTIONS(description="Total EOBI amount"),
    
    -- System Fields
    Loaded_At TIMESTAMP OPTIONS(description="Timestamp when record was loaded"),
    Created_At TIMESTAMP OPTIONS(description="Record creation timestamp")
)
PARTITION BY Payroll_Month
CLUSTER BY Employee_ID
OPTIONS(
    description="Monthly EOBI submission data - normalized fact table referencing Employees dimension",
    labels=[("subject", "eobi"), ("version", "1")]
);

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get employee EOBI history
-- SELECT 
--     e.Full_Name,
--     eobi.Payroll_Month,
--     eobi.NO_OF_DAYS_WORKED,
--     eobi.Employee_Contribution,
--     eobi.Employer_Contribution,
--     eobi.Total_EOBI
-- FROM `test-imagine-web.Vyro_Business_Paradox.Employee_EOBI` eobi
-- JOIN `test-imagine-web.Vyro_Business_Paradox.Employees` e ON eobi.Employee_ID = e.Employee_ID
-- WHERE eobi.Employee_ID = 5395
-- ORDER BY eobi.Payroll_Month DESC;

-- Monthly EOBI summary
-- SELECT 
--     Payroll_Month,
--     COUNT(DISTINCT Employee_ID) as Employee_Count,
--     SUM(Employee_Contribution) as Total_Employee_Contribution,
--     SUM(Employer_Contribution) as Total_Employer_Contribution,
--     SUM(Total_EOBI) as Total_EOBI
-- FROM `test-imagine-web.Vyro_Business_Paradox.Employee_EOBI`
-- GROUP BY Payroll_Month
-- ORDER BY Payroll_Month DESC;


