-- ============================================================================
-- CREATE PAY TEMPLATE TABLES FOR NEW HIRES, LEAVERS, AND INCREMENTS
-- ============================================================================
-- These tables store payroll template data for processing monthly payroll changes
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- ============================================================================

-- ============================================================================
-- PAY_TEMPLATE_NEW_HIRES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.Pay_Template_New_Hires` (
  Type STRING NOT NULL OPTIONS(description="Always 'New Hire'"),
  Month STRING NOT NULL OPTIONS(description="YYYY-MM format, extracted from Date_of_Joining"),
  Employee_ID STRING OPTIONS(description="Employee ID from Employees table (may be looked up)"),
  Employee_Name STRING NOT NULL OPTIONS(description="Full name of employee"),
  Designation STRING OPTIONS(description="Job title/designation"),
  Official_Email STRING OPTIONS(description="Official email address"),
  Date_of_Joining DATE OPTIONS(description="Date employee joined"),
  Currency STRING NOT NULL OPTIONS(description="PKR or USD"),
  Salary FLOAT64 NOT NULL OPTIONS(description="Monthly salary amount"),
  Employment_Location STRING OPTIONS(description="Work location (Islamabad, Remote, etc.)"),
  Bank_Name STRING OPTIONS(description="Bank name for salary transfer"),
  Bank_Account_Title STRING OPTIONS(description="Account holder name"),
  Bank_Account_Number_IBAN STRING OPTIONS(description="Bank account number or IBAN (24 digits)"),
  Swift_Code_BIC STRING OPTIONS(description="SWIFT/BIC code for international transfers"),
  Comments_by_Aun STRING OPTIONS(description="Comments by Aun"),
  Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  Updated_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
CLUSTER BY Month, Employee_ID
OPTIONS(
  description="Pay template data for new hires",
  labels=[("version", "1"), ("environment", "production"), ("managed_by", "people_team")]
);

-- ============================================================================
-- PAY_TEMPLATE_LEAVERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.Pay_Template_Leavers` (
  Type STRING NOT NULL OPTIONS(description="Always 'Leaver'"),
  Month STRING NOT NULL OPTIONS(description="YYYY-MM format, extracted from Employment_End_Date"),
  Employee_ID STRING OPTIONS(description="Employee ID from Employees table (may be looked up)"),
  Employee_Name STRING NOT NULL OPTIONS(description="Full name of employee"),
  Employment_End_Date DATE OPTIONS(description="Last working day"),
  Payroll_Type STRING NOT NULL OPTIONS(description="PKR or USD"),
  Comments STRING OPTIONS(description="General comments"),
  Devices_Returned STRING OPTIONS(description="Whether devices were returned (Yes/No)"),
  Comments_by_Aun STRING OPTIONS(description="Comments by Aun"),
  Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  Updated_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
CLUSTER BY Month, Employee_ID
OPTIONS(
  description="Pay template data for leavers",
  labels=[("version", "1"), ("environment", "production"), ("managed_by", "people_team")]
);

-- ============================================================================
-- PAY_TEMPLATE_INCREMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.Pay_Template_Increments` (
  Type STRING NOT NULL OPTIONS(description="Always 'Increment'"),
  Month STRING NOT NULL OPTIONS(description="YYYY-MM format, extracted from Effective_Date"),
  Employee_ID STRING OPTIONS(description="Employee ID from Employees table (may be looked up)"),
  Employee_Name STRING NOT NULL OPTIONS(description="Full name of employee"),
  Currency STRING NOT NULL OPTIONS(description="PKR or USD"),
  Previous_Salary FLOAT64 OPTIONS(description="Previous salary (may be looked up from Salaries/Employees table)"),
  Updated_Salary FLOAT64 NOT NULL OPTIONS(description="New salary after increment"),
  Effective_Date DATE OPTIONS(description="Date increment becomes effective"),
  Comments STRING OPTIONS(description="General comments"),
  Remarks STRING OPTIONS(description="Additional remarks"),
  Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  Updated_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
CLUSTER BY Month, Employee_ID
OPTIONS(
  description="Pay template data for salary increments",
  labels=[("version", "1"), ("environment", "production"), ("managed_by", "people_team")]
);

-- ============================================================================
-- CREATE INDEXES/CLUSTERING NOTES
-- ============================================================================
-- Tables are clustered by Month and Employee_ID for efficient filtering
-- Month field enables fast filtering by payroll month
-- Employee_ID enables joins with Employees table
