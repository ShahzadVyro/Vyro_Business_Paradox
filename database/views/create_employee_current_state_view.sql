-- ============================================================================
-- Employee Current State View
-- ============================================================================
-- Shows current employee state including latest designation, department, 
-- salary, and bank details for payroll calculations
-- 
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- View: Employee_Current_State_View
-- ============================================================================

CREATE OR REPLACE VIEW `test-imagine-web.Vyro_Business_Paradox.Employee_Current_State_View` AS
SELECT 
    e.Employee_ID,
    e.Full_Name,
    e.Official_Email,
    e.Designation,
    e.Department,
    e.Employment_Status,
    e.Joining_Date,
    e.Employment_End_Date,
    
    -- Latest salary information
    COALESCE(
        (SELECT New_Salary 
         FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salary_History` sh
         WHERE sh.Employee_ID = e.Employee_ID
         ORDER BY sh.Effective_Date DESC
         LIMIT 1),
        NULL
    ) AS Current_Salary,
    
    COALESCE(
        (SELECT Effective_Date 
         FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salary_History` sh
         WHERE sh.Employee_ID = e.Employee_ID
         ORDER BY sh.Effective_Date DESC
         LIMIT 1),
        e.Joining_Date
    ) AS Salary_Effective_Date,
    
    -- Latest designation change
    COALESCE(
        (SELECT New_Designation 
         FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salary_History` sh
         WHERE sh.Employee_ID = e.Employee_ID
           AND sh.New_Designation IS NOT NULL
         ORDER BY sh.Effective_Date DESC
         LIMIT 1),
        e.Designation
    ) AS Current_Designation,
    
    -- Latest department change
    COALESCE(
        (SELECT New_Department 
         FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salary_History` sh
         WHERE sh.Employee_ID = e.Employee_ID
           AND sh.New_Department IS NOT NULL
         ORDER BY sh.Effective_Date DESC
         LIMIT 1),
        e.Department
    ) AS Current_Department,
    
    -- Bank details (from Employees table, can be updated via Employee_Field_Updates)
    e.Bank_Account_Number_IBAN AS Current_Bank_Account,
    e.Bank_Name AS Current_Bank_Name,
    
    -- Latest bank account change date
    CAST(COALESCE(
        (SELECT CAST(Updated_Date AS TIMESTAMP)
         FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Field_Updates` fu
         WHERE fu.Employee_ID = e.Employee_ID
           AND fu.Field_Name IN ('Bank_Account_Number_IBAN', 'Bank_Name')
         ORDER BY fu.Updated_Date DESC
         LIMIT 1),
        CAST(e.Created_At AS TIMESTAMP)
    ) AS TIMESTAMP) AS Bank_Account_Updated_Date,
    
    -- Currency (determined by salary currency)
    COALESCE(
        (SELECT Currency 
         FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries` s
         WHERE s.Employee_ID = e.Employee_ID
         ORDER BY s.Payroll_Month DESC
         LIMIT 1),
        'PKR'  -- Default to PKR
    ) AS Salary_Currency,
    
    e.Updated_At AS Last_Updated
FROM 
    `test-imagine-web.Vyro_Business_Paradox.Employees` e
WHERE 
    e.Employment_Status = 'Active'
    OR e.Employment_Status IS NULL;

