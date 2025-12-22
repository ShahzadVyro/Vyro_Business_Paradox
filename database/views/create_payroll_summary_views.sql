-- ============================================================================
-- Payroll Summary Views
-- ============================================================================
-- Monthly payroll summaries by department/currency
-- Year-to-date totals and salary trends
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Views: Payroll_Summary_Monthly, Payroll_Summary_YTD
--
-- Created: January 2025
-- ============================================================================

-- Monthly Payroll Summary
CREATE OR REPLACE VIEW `test-imagine-web.Vyro_Business_Paradox.Payroll_Summary_Monthly` AS
SELECT 
    s.Payroll_Month,
    s.Currency,
    e.Department,
    COUNT(DISTINCT s.Employee_ID) as Employee_Count,
    SUM(s.Gross_Income) as Total_Gross_Income,
    SUM(s.Net_Income) as Total_Net_Income,
    SUM(s.Tax_Deduction) as Total_Tax_Deduction,
    SUM(s.EOBI) as Total_EOBI,
    SUM(s.Deductions) as Total_Deductions,
    AVG(s.Gross_Income) as Avg_Gross_Income,
    AVG(s.Net_Income) as Avg_Net_Income,
    MIN(s.Net_Income) as Min_Net_Income,
    MAX(s.Net_Income) as Max_Net_Income
FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries` s
JOIN `test-imagine-web.Vyro_Business_Paradox.Employees` e ON s.Employee_ID = e.Employee_ID
WHERE e.Is_Deleted IS NULL OR e.Is_Deleted = FALSE
GROUP BY s.Payroll_Month, s.Currency, e.Department
ORDER BY s.Payroll_Month DESC, s.Currency, e.Department;

-- Year-to-Date Payroll Summary
CREATE OR REPLACE VIEW `test-imagine-web.Vyro_Business_Paradox.Payroll_Summary_YTD` AS
SELECT 
    EXTRACT(YEAR FROM s.Payroll_Month) as Year,
    s.Currency,
    e.Department,
    COUNT(DISTINCT s.Employee_ID) as Employee_Count,
    COUNT(DISTINCT s.Payroll_Month) as Months_Counted,
    SUM(s.Gross_Income) as YTD_Gross_Income,
    SUM(s.Net_Income) as YTD_Net_Income,
    SUM(s.Tax_Deduction) as YTD_Tax_Deduction,
    SUM(s.EOBI) as YTD_EOBI,
    SUM(s.Deductions) as YTD_Deductions,
    AVG(s.Gross_Income) as Avg_Monthly_Gross_Income,
    AVG(s.Net_Income) as Avg_Monthly_Net_Income
FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries` s
JOIN `test-imagine-web.Vyro_Business_Paradox.Employees` e ON s.Employee_ID = e.Employee_ID
WHERE e.Is_Deleted IS NULL OR e.Is_Deleted = FALSE
  AND EXTRACT(YEAR FROM s.Payroll_Month) = EXTRACT(YEAR FROM CURRENT_DATE())
GROUP BY EXTRACT(YEAR FROM s.Payroll_Month), s.Currency, e.Department
ORDER BY s.Currency, e.Department;

-- Salary Trends (Last 12 Months)
CREATE OR REPLACE VIEW `test-imagine-web.Vyro_Business_Paradox.Payroll_Trends` AS
SELECT 
    s.Payroll_Month,
    s.Currency,
    COUNT(DISTINCT s.Employee_ID) as Employee_Count,
    SUM(s.Gross_Income) as Total_Gross_Income,
    SUM(s.Net_Income) as Total_Net_Income,
    LAG(SUM(s.Net_Income)) OVER (PARTITION BY s.Currency ORDER BY s.Payroll_Month) as Previous_Month_Net_Income,
    SUM(s.Net_Income) - LAG(SUM(s.Net_Income)) OVER (PARTITION BY s.Currency ORDER BY s.Payroll_Month) as Month_Over_Month_Change
FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries` s
JOIN `test-imagine-web.Vyro_Business_Paradox.Employees` e ON s.Employee_ID = e.Employee_ID
WHERE e.Is_Deleted IS NULL OR e.Is_Deleted = FALSE
  AND s.Payroll_Month >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
GROUP BY s.Payroll_Month, s.Currency
ORDER BY s.Payroll_Month DESC, s.Currency;

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Monthly payroll by department
-- SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.Payroll_Summary_Monthly`
-- WHERE Payroll_Month = DATE_TRUNC(CURRENT_DATE(), MONTH)
-- ORDER BY Total_Net_Income DESC;

-- Year-to-date summary
-- SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.Payroll_Summary_YTD`
-- ORDER BY YTD_Net_Income DESC;

-- Salary trends
-- SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.Payroll_Trends`
-- ORDER BY Payroll_Month DESC;


