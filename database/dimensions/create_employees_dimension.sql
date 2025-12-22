-- ============================================================================
-- Employees Dimension Table
-- ============================================================================
-- Single source of truth for all employee master data
-- Consolidates form data and directory data
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Table: Employees
--
-- Created: January 2025
-- ============================================================================

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.Employees` (
    
    -- ========================================================================
    -- PRIMARY KEY
    -- ========================================================================
    Employee_ID INT64 NOT NULL OPTIONS(description="Unique employee ID - preserve existing IDs, assign numeric IDs only for missing ones"),
    
    -- ========================================================================
    -- FORM FIELDS - Personal Information
    -- ========================================================================
    Timestamp TIMESTAMP OPTIONS(description="Form submission timestamp"),
    Email_Address STRING OPTIONS(description="Email used to submit form"),
    Full_Name STRING NOT NULL OPTIONS(description="Full name as per CNIC"),
    CNIC_ID STRING OPTIONS(description="CNIC/ID number"),
    Personal_Email STRING OPTIONS(description="Personal email address"),
    Contact_Number STRING OPTIONS(description="Contact phone number"),
    Date_of_Birth DATE OPTIONS(description="Date of birth"),
    Gender STRING OPTIONS(description="Gender (Male/Female/Prefer not to say)"),
    Temporary_Address STRING OPTIONS(description="Current/temporary address"),
    Permanent_Address STRING OPTIONS(description="Permanent address"),
    Nationality STRING OPTIONS(description="Nationality"),
    LinkedIn_URL STRING OPTIONS(description="LinkedIn profile URL"),
    Marital_Status STRING OPTIONS(description="Marital status (Single/Married)"),
    Age INT64 OPTIONS(description="Age (calculated or from form)"),
    Number_of_Children INT64 OPTIONS(description="Number of children"),
    Spouse_Name STRING OPTIONS(description="Spouse name (if married)"),
    Spouse_DOB DATE OPTIONS(description="Spouse date of birth"),
    
    -- ========================================================================
    -- FORM FIELDS - Employment Information
    -- ========================================================================
    Joining_Date DATE OPTIONS(description="Date of joining"),
    Department STRING OPTIONS(description="Department name"),
    Designation STRING OPTIONS(description="Job designation/title"),
    Reporting_Manager STRING OPTIONS(description="Reporting manager name"),
    Job_Type STRING OPTIONS(description="Job type (Full Time/Part Time/Internship/Consultant)"),
    Job_Location STRING OPTIONS(description="Job location (OnSite/Remote/Hybrid)"),
    Recruiter_Name STRING OPTIONS(description="Recruiter who hired"),
    Preferred_Device STRING OPTIONS(description="Preferred device (MacBook/Windows)"),
    Employment_Location STRING OPTIONS(description="Employment location"),
    
    -- ========================================================================
    -- FORM FIELDS - Emergency Contact
    -- ========================================================================
    Father_Name STRING OPTIONS(description="Father's name"),
    Emergency_Contact_Number STRING OPTIONS(description="Emergency contact phone"),
    Emergency_Contact_Relationship STRING OPTIONS(description="Relationship to employee"),
    Blood_Group STRING OPTIONS(description="Blood group (A+/A-/B+/B-/O+/O-/AB+/AB-)"),
    
    -- ========================================================================
    -- FORM FIELDS - Documents (URLs)
    -- ========================================================================
    Degree_Transcript_URL STRING OPTIONS(description="Degree/latest transcript Google Drive URL"),
    Last_Salary_Slip_URL STRING OPTIONS(description="Last salary slip URL"),
    Experience_Letter_URL STRING OPTIONS(description="Previous company experience letter URL"),
    Resume_URL STRING OPTIONS(description="Resume/CV URL"),
    Passport_Photo_URL STRING OPTIONS(description="Passport size picture URL (blue background)"),
    CNIC_Front_URL STRING OPTIONS(description="Scanned CNIC front URL"),
    CNIC_Back_URL STRING OPTIONS(description="Scanned CNIC back URL"),
    
    -- ========================================================================
    -- FORM FIELDS - Banking Information
    -- ========================================================================
    Bank_Name STRING OPTIONS(description="Bank name"),
    Bank_Account_Title STRING OPTIONS(description="Bank account title"),
    National_Tax_Number STRING OPTIONS(description="NTN number"),
    Swift_Code_BIC STRING OPTIONS(description="Swift code/BIC code"),
    Bank_Account_Number_IBAN STRING OPTIONS(description="Bank account number/IBAN (24 digits)"),
    EOBI_Number STRING OPTIONS(description="Employees Old-Age Benefits Institution registration number"),
    
    -- ========================================================================
    -- FORM FIELDS - Additional Information
    -- ========================================================================
    Vehicle_Number STRING OPTIONS(description="Vehicle registration number"),
    Introduction STRING OPTIONS(description="Brief introduction for official communications"),
    Fun_Fact STRING OPTIONS(description="Fun fact to share with team"),
    Shirt_Size STRING OPTIONS(description="Shirt size (S/M/L/XL)"),
    
    -- ========================================================================
    -- DIRECTORY-ONLY FIELDS - People Team Managed
    -- ========================================================================
    Official_Email STRING OPTIONS(description="Official company email (created by People team)"),
    Employment_End_Date DATE OPTIONS(description="Employment end date (for resigned/terminated)"),
    
    -- ========================================================================
    -- DIRECTORY-ONLY FIELDS - Calculated/Derived
    -- ========================================================================
    Probation_Period STRING OPTIONS(description="Default '3M' (3 months)"),
    Probation_End_Date DATE OPTIONS(description="Calculated: Joining_Date + 3 months"),
    IBFT_IFT STRING OPTIONS(description="Calculated: 'IFT' if Bank_Name = 'Meezan Bank', else 'IBFT'"),
    ACCOUNTNUMBER STRING OPTIONS(description="Extracted from Bank_Account_Number_IBAN"),
    BANK_CODE STRING OPTIONS(description="Extracted/derived from bank account data"),
    
    -- ========================================================================
    -- DIRECTORY-ONLY FIELDS - External System Integration
    -- ========================================================================
    Slack_ID STRING OPTIONS(description="Fetched from Slack API"),
    Group_Name STRING OPTIONS(description="Fetched from Google Admin API"),
    Group_Email STRING OPTIONS(description="Fetched from Google Admin API"),
    
    -- ========================================================================
    -- DIRECTORY-ONLY FIELDS - Lifecycle & Status
    -- ========================================================================
    Lifecycle_Status STRING OPTIONS(description="Current lifecycle stage: Form_Submitted, Data_Added, Email_Created, Employee_ID_Assigned, Onboarded, Active, Resigned, Terminated"),
    Employment_Status STRING OPTIONS(description="Employment status (Active/Resigned/Terminated)"),
    Re_Joined STRING OPTIONS(description="Re-joined status (YES/NO)"),
    
    -- ========================================================================
    -- SYSTEM FIELDS
    -- ========================================================================
    Key STRING OPTIONS(description="Composite key: Father_Name + Employee_Name + CAST(Employee_ID AS STRING)"),
    Created_At TIMESTAMP OPTIONS(description="Record creation timestamp"),
    Updated_At TIMESTAMP OPTIONS(description="Last update timestamp"),
    Created_By STRING OPTIONS(description="User/system that created record"),
    Updated_By STRING OPTIONS(description="User/system that last updated record"),
    Is_Deleted BOOL OPTIONS(description="Soft delete flag")
)
CLUSTER BY Employee_ID, Lifecycle_Status, Department
OPTIONS(
    description="Unified employee master data - single source of truth combining form and directory data",
    labels=[("version", "1"), ("environment", "production"), ("managed_by", "people_team")]
);

-- ============================================================================
-- CREATE INDEXES FOR BETTER QUERY PERFORMANCE
-- ============================================================================
-- Note: BigQuery uses clustering instead of traditional indexes
-- Clustering is defined above on Employee_ID, Lifecycle_Status, Department

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get all active employees
-- SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.Employees`
-- WHERE Employment_Status = 'Active' AND (Is_Deleted IS NULL OR Is_Deleted = FALSE)
-- ORDER BY Full_Name;

-- Get employees by lifecycle status (for onboarding tracking)
-- SELECT 
--     Lifecycle_Status,
--     COUNT(*) as count
-- FROM `test-imagine-web.Vyro_Business_Paradox.Employees`
-- WHERE Is_Deleted IS NULL OR Is_Deleted = FALSE
-- GROUP BY Lifecycle_Status
-- ORDER BY count DESC;

-- Get employees missing Employee_ID (for assignment)
-- SELECT 
--     Full_Name,
--     CNIC_ID,
--     Joining_Date
-- FROM `test-imagine-web.Vyro_Business_Paradox.Employees`
-- WHERE Employee_ID IS NULL
-- ORDER BY Joining_Date;


