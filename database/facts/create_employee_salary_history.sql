-- ============================================================================
-- Employee Salary History Fact Table
-- ============================================================================
-- Tracks salary changes over time including increments, promotions, 
-- designation changes, and department changes
-- 
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Table: Employee_Salary_History
-- ============================================================================

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.Employee_Salary_History` (
    Salary_History_ID INT64 NOT NULL OPTIONS(description="Primary key, auto-generated"),
    Employee_ID INT64 NOT NULL OPTIONS(description="Foreign key to Employees table"),
    Effective_Date DATE NOT NULL OPTIONS(description="Date when change took effect"),
    Change_Type STRING NOT NULL OPTIONS(description="Type of change: Increment, Promotion, Designation_Change, Department_Change, Salary_Adjustment"),
    Previous_Salary NUMERIC OPTIONS(description="Previous salary amount"),
    New_Salary NUMERIC OPTIONS(description="New salary amount"),
    Previous_Designation STRING OPTIONS(description="Previous job designation"),
    New_Designation STRING OPTIONS(description="New job designation"),
    Previous_Department STRING OPTIONS(description="Previous department"),
    New_Department STRING OPTIONS(description="New department"),
    Reason STRING OPTIONS(description="Reason for change"),
    Approved_By STRING OPTIONS(description="Person who approved the change"),
    Created_At TIMESTAMP OPTIONS(description="Record creation timestamp"),
    Created_By STRING OPTIONS(description="User/system that created the record")
)
PARTITION BY Effective_Date
CLUSTER BY Employee_ID, Change_Type
OPTIONS(
    description="Historical tracking of salary, designation, and department changes"
);


