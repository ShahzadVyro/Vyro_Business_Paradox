-- ============================================================================
-- Comprehensive Salary View
-- ============================================================================
-- Joins Employee_Salaries with current employee state, OPD benefits, 
-- tax calculations, and salary history for complete salary information
-- 
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- View: Comprehensive_Salary_View
-- ============================================================================

CREATE OR REPLACE VIEW `test-imagine-web.Vyro_Business_Paradox.Comprehensive_Salary_View` AS
SELECT 
    -- Employee Information
    e.Employee_ID,
    e.Full_Name,
    e.Official_Email,
    e.Employment_Status,
    
    -- Salary Information
    s.Salary_ID,
    s.Payroll_Month,
    s.Currency,
    s.Regular_Pay,
    s.Prorated_Pay,
    s.Performance_Bonus,
    s.Paid_Overtime,
    s.Reimbursements,
    s.Gross_Income,
    s.Net_Income,
    s.Worked_Days,
    
    -- Employee State at Payroll
    COALESCE(s.Designation_At_Payroll, e.Designation) AS Designation_At_Payroll,
    COALESCE(s.Department_At_Payroll, e.Department) AS Department_At_Payroll,
    COALESCE(s.Bank_Account_At_Payroll, e.Bank_Account_Number_IBAN) AS Bank_Account_At_Payroll,
    COALESCE(s.Bank_Name_At_Payroll, e.Bank_Name) AS Bank_Name_At_Payroll,
    s.Salary_Effective_Date,
    
    -- PKR Specific Fields
    s.Prorated_Base_Pay,
    s.Prorated_Medical_Allowance,
    s.Prorated_Transport_Allowance,
    s.Prorated_Inflation_Allowance,
    s.Taxable_Income,
    s.Tax_Deduction,
    s.EOBI,
    s.Loan_Deduction,
    s.Recoveries,
    s.Deductions,
    
    -- Tax Information
    t.Tax_Amount AS Tax_Amount_Calculated,
    t.Tax_Rate,
    t.Tax_Type,
    t.Tax_Bracket,
    
    -- OPD Information (for PKR employees)
    opd.Benefit_Month AS OPD_Benefit_Month,
    opd.Contribution_Amount AS OPD_Contribution,
    opd.Claimed_Amount AS OPD_Claimed,
    opd.Balance AS OPD_Balance,
    
    -- Current OPD Balance
    (
        SELECT `test-imagine-web.Vyro_Business_Paradox.Calculate_OPD_Balance`(e.Employee_ID, s.Payroll_Month)
    ) AS OPD_Balance_As_Of_Month,
    
    -- Salary History Info (latest change effective before or on payroll month)
    (
        SELECT Change_Type
        FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salary_History` sh2
        WHERE sh2.Employee_ID = s.Employee_ID
          AND sh2.Effective_Date <= s.Payroll_Month
        ORDER BY sh2.Effective_Date DESC
        LIMIT 1
    ) AS Latest_Salary_Change_Type,
    (
        SELECT Effective_Date
        FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salary_History` sh3
        WHERE sh3.Employee_ID = s.Employee_ID
          AND sh3.Effective_Date <= s.Payroll_Month
        ORDER BY sh3.Effective_Date DESC
        LIMIT 1
    ) AS Latest_Salary_Change_Date,
    (
        SELECT New_Salary
        FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salary_History` sh4
        WHERE sh4.Employee_ID = s.Employee_ID
          AND sh4.Effective_Date <= s.Payroll_Month
        ORDER BY sh4.Effective_Date DESC
        LIMIT 1
    ) AS Latest_Salary_Amount,
    
    -- Comments
    s.Comments AS Salary_Comments,
    s.Internal_Comments AS Salary_Internal_Comments,
    opd.Comments AS OPD_Comments,
    
    -- Timestamps
    s.Created_At AS Salary_Created_At,
    s.Loaded_At AS Salary_Loaded_At
FROM 
    `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries` s
INNER JOIN 
    `test-imagine-web.Vyro_Business_Paradox.Employees` e 
    ON s.Employee_ID = e.Employee_ID
LEFT JOIN 
    `test-imagine-web.Vyro_Business_Paradox.Employee_Tax_Calculations` t
    ON s.Employee_ID = t.Employee_ID
    AND s.Payroll_Month = t.Payroll_Month
LEFT JOIN 
    `test-imagine-web.Vyro_Business_Paradox.Employee_OPD_Benefits` opd
    ON s.Employee_ID = opd.Employee_ID
    AND s.Payroll_Month = opd.Benefit_Month
    AND s.Currency = 'PKR'
ORDER BY 
    s.Payroll_Month DESC,
    e.Full_Name;

