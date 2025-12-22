-- ============================================================================
-- Employee Field Updates History Table
-- ============================================================================
-- Tracks all field changes for audit purposes (especially bank account changes)
-- Required for compliance and audit requirements
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Table: Employee_Field_Updates
--
-- Created: January 2025
-- ============================================================================

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.Employee_Field_Updates` (
    Update_ID INT64 NOT NULL OPTIONS(description="Unique update record identifier"),
    Employee_ID INT64 NOT NULL OPTIONS(description="Employee ID (FK to Employees)"),
    Field_Name STRING NOT NULL OPTIONS(description="Name of the field that was updated"),
    Old_Value STRING OPTIONS(description="Previous value (before update)"),
    New_Value STRING OPTIONS(description="New value (after update)"),
    Updated_Date TIMESTAMP NOT NULL OPTIONS(description="When this update occurred"),
    Updated_By STRING OPTIONS(description="User/system that made this update"),
    Reason STRING OPTIONS(description="Reason for the update"),
    Created_At TIMESTAMP OPTIONS(description="Record creation timestamp")
)
CLUSTER BY Employee_ID, Updated_Date
OPTIONS(
    description="Audit trail of all field changes for compliance and tracking",
    labels=[("subject", "audit"), ("version", "1")]
);

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get all bank account changes for an employee
-- SELECT 
--     Field_Name,
--     Old_Value,
--     New_Value,
--     Updated_Date,
--     Updated_By,
--     Reason
-- FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Field_Updates`
-- WHERE Employee_ID = 5395
--   AND Field_Name IN ('Bank_Name', 'Bank_Account_Number_IBAN', 'Bank_Account_Title')
-- ORDER BY Updated_Date DESC;

-- Get all changes made by a specific user
-- SELECT 
--     e.Full_Name,
--     u.Field_Name,
--     u.Old_Value,
--     u.New_Value,
--     u.Updated_Date,
--     u.Reason
-- FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Field_Updates` u
-- JOIN `test-imagine-web.Vyro_Business_Paradox.Employees` e ON u.Employee_ID = e.Employee_ID
-- WHERE u.Updated_By = 'user@vyro.ai'
-- ORDER BY u.Updated_Date DESC;

-- Audit: Find sensitive field changes without reason
-- SELECT 
--     Employee_ID,
--     Field_Name,
--     Updated_Date,
--     Updated_By
-- FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Field_Updates`
-- WHERE Field_Name IN ('Bank_Account_Number_IBAN', 'CNIC_ID', 'National_Tax_Number')
--   AND (Reason IS NULL OR Reason = '')
-- ORDER BY Updated_Date DESC;


