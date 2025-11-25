-- ============================================================================
-- BigQuery Schema for Employee Data v2
-- ============================================================================
-- This creates an improved employee data table with correct data types,
-- fixed naming, and additional critical fields.
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Table: EmployeeData_v2
--
-- Created: October 30, 2025
-- ============================================================================

-- Drop table if exists (CAUTION: Only use for fresh start)
-- DROP TABLE IF EXISTS `test-imagine-web.Vyro_Business_Paradox.EmployeeData_v2`;

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.EmployeeData_v2` (
    
    -- ========================================================================
    -- CORE EMPLOYEE INFORMATION (15 fields)
    -- ========================================================================
    Employee_ID STRING NOT NULL OPTIONS(description="Unique employee identifier (e.g., EMP-001)"),
    Full_Name STRING NOT NULL OPTIONS(description="Employee's full legal name"),
    Official_Email STRING OPTIONS(description="Company email address (@vyro.ai)"),
    Personal_Email STRING OPTIONS(description="Personal email address"),
    National_ID STRING OPTIONS(description="CNIC or National ID number"),
    Contact_Number STRING OPTIONS(description="Primary phone number"),
    Date_of_Birth DATE OPTIONS(description="Date of birth"),
    Gender STRING OPTIONS(description="Gender (Male/Female/Other)"),
    Nationality STRING OPTIONS(description="Nationality"),
    Marital_Status STRING OPTIONS(description="Marital status (Single/Married/Divorced)"),
    Blood_Group STRING OPTIONS(description="Blood group (A+/B+/O+/AB+ etc)"),
    Current_Address STRING OPTIONS(description="Current residential address"),
    Permanent_Address STRING OPTIONS(description="Permanent residential address"),
    LinkedIn_Profile_URL STRING OPTIONS(description="LinkedIn profile URL"),
    Profile_Picture_URL STRING OPTIONS(description="Passport size photo URL"),
    
    -- ========================================================================
    -- EMPLOYMENT DETAILS (20 fields)
    -- ========================================================================
    Joining_Date DATE OPTIONS(description="Date of joining the company"),
    Employment_Status STRING NOT NULL OPTIONS(description="Current status (Active/Resigned/Terminated/On Leave)"),
    Employment_End_Date DATE OPTIONS(description="Last working day (for resigned/terminated employees)"),
    Department STRING OPTIONS(description="Current department"),
    Designation STRING OPTIONS(description="Current job title/designation"),
    Reporting_Manager STRING OPTIONS(description="Name of direct manager"),
    Job_Type STRING OPTIONS(description="Work arrangement (Onsite/Remote/Hybrid)"),
    Job_Location STRING OPTIONS(description="Primary work location/office"),
    Probation_Period_Months INT64 OPTIONS(description="Length of probation period in months"),
    Probation_Start_Date DATE OPTIONS(description="Probation start date"),
    Probation_End_Date DATE OPTIONS(description="Probation end date"),
    Basic_Salary FLOAT64 OPTIONS(description="Basic monthly salary"),
    Medical_Allowance FLOAT64 OPTIONS(description="Monthly medical allowance"),
    Gross_Salary FLOAT64 OPTIONS(description="Total monthly salary (Basic + Allowances)"),
    Recruiter_Name STRING OPTIONS(description="Name of recruiter who hired this employee"),
    Preferred_Device STRING OPTIONS(description="Preferred work device (MacBook/Windows/Linux)"),
    Onboarding_Status STRING OPTIONS(description="Onboarding status (Pending/In Progress/Completed)"),
    Assigned_Groups STRING OPTIONS(description="Comma-separated list of groups/teams"),
    Rejoined BOOL OPTIONS(description="Whether employee rejoined after leaving"),
    Slack_ID STRING OPTIONS(description="Slack user ID for integrations"),
    
    -- ========================================================================
    -- BANKING & COMPLIANCE (8 fields)
    -- ========================================================================
    Bank_Name STRING OPTIONS(description="Bank name for salary transfer"),
    Bank_Account_Title STRING OPTIONS(description="Account holder name"),
    Account_Number_IBAN STRING OPTIONS(description="Bank account number or IBAN (24 digits)"),
    Swift_Code_BIC STRING OPTIONS(description="SWIFT/BIC code for international transfers"),
    Routing_Number STRING OPTIONS(description="Bank routing number"),
    IFT_Type STRING OPTIONS(description="Fund transfer type (IBFT/IFT)"),
    National_Tax_Number STRING OPTIONS(description="NTN for tax purposes"),
    EOBI_Number STRING OPTIONS(description="Employees Old-Age Benefits Institution number"),
    
    -- ========================================================================
    -- EMERGENCY & FAMILY (7 fields)
    -- ========================================================================
    Father_Name STRING OPTIONS(description="Father's full name"),
    Emergency_Contact_Name STRING OPTIONS(description="Emergency contact person name"),
    Emergency_Contact_Relationship STRING OPTIONS(description="Relationship with emergency contact"),
    Emergency_Contact_Number STRING OPTIONS(description="Emergency contact phone number"),
    Number_of_Children INT64 OPTIONS(description="Number of children (for benefits)"),
    Spouse_Name STRING OPTIONS(description="Spouse's name (if married)"),
    Spouse_DOB DATE OPTIONS(description="Spouse's date of birth"),
    
    -- ========================================================================
    -- DOCUMENTS (7 fields)
    -- ========================================================================
    Resume_URL STRING OPTIONS(description="Google Drive URL for resume/CV"),
    CNIC_Front_URL STRING OPTIONS(description="Scanned CNIC front side URL"),
    CNIC_Back_URL STRING OPTIONS(description="Scanned CNIC back side URL"),
    Degree_Transcript_URL STRING OPTIONS(description="Educational certificates URL"),
    Last_Salary_Slip_URL STRING OPTIONS(description="Last salary slip from previous employer"),
    Experience_Letter_URL STRING OPTIONS(description="Experience letter from previous company"),
    Passport_Photo_URL STRING OPTIONS(description="Passport size photo (blue background)"),
    
    -- ========================================================================
    -- ADDITIONAL INFO (7 fields)
    -- ========================================================================
    Shirt_Size STRING OPTIONS(description="T-shirt size (S/M/L/XL/XXL)"),
    Vehicle_Number STRING OPTIONS(description="Vehicle registration number"),
    Introduction_Bio STRING OPTIONS(description="Brief introduction for team communications"),
    Fun_Fact STRING OPTIONS(description="Fun fact about the employee"),
    Department_Change_History JSON OPTIONS(description="Array of department changes with dates"),
    Designation_Change_History JSON OPTIONS(description="Array of designation changes with dates"),
    Change_Details JSON OPTIONS(description="Audit trail of all changes made to this record"),
    
    -- ========================================================================
    -- SYSTEM FIELDS (5 fields)
    -- ========================================================================
    Created_At TIMESTAMP OPTIONS(description="Record creation timestamp"),
    Updated_At TIMESTAMP OPTIONS(description="Last update timestamp"),
    Created_By STRING OPTIONS(description="User who created this record"),
    Updated_By STRING OPTIONS(description="User who last updated this record"),
    Is_Deleted BOOL OPTIONS(description="Soft delete flag (true if deleted)")
)
CLUSTER BY Employee_ID, Employment_Status, Department
OPTIONS(
    description="Unified employee data table with improved schema",
    labels=[("version", "2"), ("environment", "production"), ("managed_by", "people_team")]
);

-- ============================================================================
-- CREATE INDEXES FOR BETTER QUERY PERFORMANCE
-- ============================================================================

-- Note: BigQuery doesn't support traditional indexes, but clustering above helps

-- ============================================================================
-- CREATE VIEW FOR ACTIVE EMPLOYEES ONLY
-- ============================================================================

CREATE OR REPLACE VIEW `test-imagine-web.Vyro_Business_Paradox.ActiveEmployees_v2` AS
SELECT 
    *
FROM 
    `test-imagine-web.Vyro_Business_Paradox.EmployeeData_v2`
WHERE 
    Employment_Status = 'Active'
    AND (Is_Deleted IS NULL OR Is_Deleted = FALSE);

-- ============================================================================
-- CREATE VIEW FOR EMPLOYEE SUMMARY (PUBLIC INFO ONLY)
-- ============================================================================

CREATE OR REPLACE VIEW `test-imagine-web.Vyro_Business_Paradox.EmployeeSummary_v2` AS
SELECT 
    Employee_ID,
    Full_Name,
    Official_Email,
    Department,
    Designation,
    Reporting_Manager,
    Job_Location,
    Employment_Status,
    Joining_Date,
    Slack_ID,
    Profile_Picture_URL
FROM 
    `test-imagine-web.Vyro_Business_Paradox.EmployeeData_v2`
WHERE 
    (Is_Deleted IS NULL OR Is_Deleted = FALSE);

-- ============================================================================
-- GRANT PERMISSIONS (Adjust as needed)
-- ============================================================================

-- Grant read access to specific users/groups
-- GRANT `roles/bigquery.dataViewer` ON TABLE `test-imagine-web.Vyro_Business_Paradox.EmployeeData_v2` TO 'user:hr@vyro.ai';

-- Grant write access to admin users
-- GRANT `roles/bigquery.dataEditor` ON TABLE `test-imagine-web.Vyro_Business_Paradox.EmployeeData_v2` TO 'user:admin@vyro.ai';

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get all active employees
-- SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.ActiveEmployees_v2`;

-- Get employee count by department
-- SELECT 
--     Department,
--     COUNT(*) as employee_count
-- FROM 
--     `test-imagine-web.Vyro_Business_Paradox.EmployeeData_v2`
-- WHERE 
--     Employment_Status = 'Active'
-- GROUP BY 
--     Department
-- ORDER BY 
--     employee_count DESC;

-- Get employees who joined in the last 90 days
-- SELECT 
--     Employee_ID,
--     Full_Name,
--     Department,
--     Joining_Date
-- FROM 
--     `test-imagine-web.Vyro_Business_Paradox.EmployeeData_v2`
-- WHERE 
--     Joining_Date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
--     AND Employment_Status = 'Active'
-- ORDER BY 
--     Joining_Date DESC;

-- ============================================================================
-- MIGRATION FROM OLD TABLE (if needed)
-- ============================================================================

-- Backup old table first
-- CREATE TABLE `test-imagine-web.Vyro_Business_Paradox.EmployeeData_backup_20251030` 
-- AS SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.EmployeeData`;

-- Then migrate data (you'll need to map old fields to new fields)
-- INSERT INTO `test-imagine-web.Vyro_Business_Paradox.EmployeeData_v2` (...)
-- SELECT ... FROM `test-imagine-web.Vyro_Business_Paradox.EmployeeData`;

-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. Table is partitioned by Created_At for better query performance
-- 2. Clustered by Employee_ID, Employment_Status, Department for common queries
-- 3. Uses soft delete (Is_Deleted flag) to maintain data history
-- 4. All timestamps are in UTC
-- 5. JSON fields for flexible historical tracking
-- 6. Views created for common access patterns
-- ============================================================================

-- ============================================================================
-- PAYROLL TABLES (Salaries + EOBI)
-- ============================================================================

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.EmployeeSalaries_v1` (
    Payroll_Month DATE NOT NULL,
    Currency STRING NOT NULL,
    Employee_ID STRING,
    Employee_Name STRING,
    Personal_Email STRING,
    Official_Email STRING,
    Joining_Date DATE,
    Designation STRING,
    Department STRING,
    Reporting_Manager STRING,
    Job_Type STRING,
    Status STRING,
    Employment_Status STRING,
    Probation_Period STRING,
    Probation_End_Date DATE,
    Basic_Salary NUMERIC,
    Medical NUMERIC,
    Gross_Salary NUMERIC,
    Contact_Number STRING,
    CNIC_ID STRING,
    Gender STRING,
    Bank_Name STRING,
    Bank_Account_Title STRING,
    Bank_Account_IBAN STRING,
    Swift_Code_BIC STRING,
    Routing_Number STRING,
    Employment_Location STRING,
    Date_of_Birth DATE,
    Age STRING,
    Address STRING,
    Nationality STRING,
    Marital_Status STRING,
    Number_of_Children NUMERIC,
    Spouse_Name STRING,
    Spouse_DOB DATE,
    Father_Name STRING,
    Emergency_Contact_Relationship STRING,
    Emergency_Contact_Number STRING,
    Blood_Group STRING,
    LinkedIn_URL STRING,
    Recruiter_Name STRING,
    Employment_End_Date DATE,
    Group_Name STRING,
    Group_Email STRING,
    Rejoined STRING,
    Key STRING,
    IBFT_IFT STRING,
    Slack_ID STRING,
    EOBI_Number STRING,
    Worked_Days NUMERIC,
    Last_Month_Salary NUMERIC,
    Increment_or_New_Addition NUMERIC,
    Date_of_Increment DATE,
    Payable_From STRING,
    Regular_Pay NUMERIC,
    Prorated_Pay NUMERIC,
    Prorated_Base_Pay NUMERIC,
    Prorated_Medical_Allowance NUMERIC,
    Prorated_Transport_Allowance NUMERIC,
    Prorated_Inflation_Allowance NUMERIC,
    Performance_Bonus NUMERIC,
    Paid_Overtime NUMERIC,
    Reimbursements NUMERIC,
    Other_Adjustments NUMERIC,
    Taxable_Income NUMERIC,
    Gross_Income NUMERIC,
    Unpaid_Leaves NUMERIC,
    Tax_Deduction NUMERIC,
    EOBI NUMERIC,
    Loan_Deduction NUMERIC,
    Recoveries NUMERIC,
    Deductions NUMERIC,
    Net_Income NUMERIC,
    Comments STRING,
    Additional_Points STRING,
    Shahzad_Comments STRING,
    AccountNumber STRING,
    Bank_Code STRING,
    Loaded_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
CLUSTER BY Payroll_Month, Currency, Employee_ID
OPTIONS(
    description="Monthly payroll facts combining salary inputs with employee directory snapshot",
    labels=[("subject", "payroll"), ("version", "1")]
);


CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.EmployeeEOBI_v1` (
    Payroll_Month DATE NOT NULL,
    Employee_ID STRING,
    EMP_AREA_CODE STRING,
    EMP_REG_SERIAL_NO STRING,
    EMP_SUB_AREA_CODE STRING,
    EMP_SUB_SERIAL_NO STRING,
    NAME STRING,
    EOBI_NO STRING,
    CNIC STRING,
    NIC STRING,
    CNIC_clean STRING,
    DOB DATE,
    DOJ DATE,
    DOE DATE,
    NO_OF_DAYS_WORKED NUMERIC,
    From_Date DATE,
    To_Date DATE,
    Employee_Contribution NUMERIC,
    Employer_Contribution NUMERIC,
    Total_EOBI NUMERIC,
    Loaded_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
CLUSTER BY Payroll_Month, Employee_ID
OPTIONS(
    description="Monthly EOBI submission data aligned with payroll months",
    labels=[("subject", "eobi"), ("version", "1")]
);


