-- ============================================================================
-- BigQuery Schema for Directory Employees Data Table
-- ============================================================================
-- This creates a table for employee directory data
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Table: Directory_Employees_Data
--
-- Created: January 2025
-- ============================================================================

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.Directory_Employees_Data` (
    ID INT64 OPTIONS(description="Employee ID"),
    Name STRING OPTIONS(description="Employee full name"),
    Personal_Email STRING OPTIONS(description="Personal email address"),
    Official_Email STRING OPTIONS(description="Official company email"),
    Joining_Date DATE OPTIONS(description="Date of joining"),
    Designation STRING OPTIONS(description="Job designation/title"),
    Department STRING OPTIONS(description="Department name"),
    Reporting_Manager STRING OPTIONS(description="Reporting manager name"),
    Job_Type STRING OPTIONS(description="Job type (Onsite/Remote/Permanent/Consultant)"),
    Status STRING OPTIONS(description="Employment status (Active/Inactive)"),
    Probation_Period STRING OPTIONS(description="Probation period (e.g., 3M)"),
    Probation_End_Date DATE OPTIONS(description="Probation end date"),
    Contact_Number STRING OPTIONS(description="Contact phone number"),
    CNIC_ID STRING OPTIONS(description="CNIC or National ID number"),
    Gender STRING OPTIONS(description="Gender (Male/Female)"),
    Bank_Name STRING OPTIONS(description="Bank name"),
    Bank_Account_Title STRING OPTIONS(description="Bank account title/name"),
    Bank_Account_Number_IBAN STRING OPTIONS(description="Bank account number or IBAN"),
    Swift_Code_BIC STRING OPTIONS(description="SWIFT/BIC code"),
    Routing_Number STRING OPTIONS(description="Routing number"),
    Employment_Location STRING OPTIONS(description="Employment location"),
    Date_of_Birth DATE OPTIONS(description="Date of birth"),
    Age STRING OPTIONS(description="Age (as string, e.g., '25 Years')"),
    Address STRING OPTIONS(description="Residential address"),
    Nationality STRING OPTIONS(description="Nationality"),
    Marital_Status STRING OPTIONS(description="Marital status (Single/Married)"),
    Fathers_Name STRING OPTIONS(description="Father's name"),
    Emergency_Contact_Relationship STRING OPTIONS(description="Emergency contact relationship"),
    Emergency_Contact_Number STRING OPTIONS(description="Emergency contact phone number"),
    Blood_Group STRING OPTIONS(description="Blood group"),
    LinkedIn_URL STRING OPTIONS(description="LinkedIn profile URL"),
    Recruiter_Name STRING OPTIONS(description="Recruiter name"),
    Employment_End_Date DATE OPTIONS(description="Employment end date"),
    Group_Name STRING OPTIONS(description="Group/team name"),
    Group_Email STRING OPTIONS(description="Group email address"),
    Re_Joined STRING OPTIONS(description="Re-joined status (YES/NO)"),
    Status_Duplicate STRING OPTIONS(description="Duplicate status field from source"),
    Key STRING OPTIONS(description="Unique key identifier"),
    Loaded_At TIMESTAMP OPTIONS(description="Timestamp when record was loaded")
)
CLUSTER BY ID, Status, Department
OPTIONS(
    description="Employee directory data from CSV export",
    labels=[("subject", "directory"), ("source", "csv"), ("version", "1")]
);

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get all active employees
-- SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.Directory_Employees_Data`
-- WHERE Status = 'Active'
-- ORDER BY Name;

-- Get employees by department
-- SELECT 
--     Department,
--     COUNT(*) as Employee_Count
-- FROM `test-imagine-web.Vyro_Business_Paradox.Directory_Employees_Data`
-- WHERE Status = 'Active'
-- GROUP BY Department
-- ORDER BY Employee_Count DESC;

-- Get employees who joined recently
-- SELECT 
--     ID,
--     Name,
--     Designation,
--     Department,
--     Joining_Date
-- FROM `test-imagine-web.Vyro_Business_Paradox.Directory_Employees_Data`
-- WHERE Joining_Date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
--     AND Status = 'Active'
-- ORDER BY Joining_Date DESC;

