-- ============================================================================
-- OPD Balance Calculation Function
-- ============================================================================
-- Calculates running OPD balance for an employee
-- Formula: SUM(Contributions) - SUM(Claims)
-- Only for PKR salaried employees
-- 
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Function: Calculate_OPD_Balance
-- ============================================================================

CREATE OR REPLACE FUNCTION `test-imagine-web.Vyro_Business_Paradox.Calculate_OPD_Balance`(
    employee_id INT64,
    as_of_date DATE
) RETURNS NUMERIC AS (
    CAST((
        SELECT 
            COALESCE(SUM(Contribution_Amount), 0) - COALESCE(SUM(Claimed_Amount), 0)
        FROM 
            `test-imagine-web.Vyro_Business_Paradox.Employee_OPD_Benefits`
        WHERE 
            Employee_ID = employee_id
            AND Benefit_Month <= as_of_date
            AND Currency = 'PKR'
    ) AS NUMERIC)
);

-- ============================================================================
-- Usage Examples
-- ============================================================================

-- Get current OPD balance for an employee
-- SELECT `test-imagine-web.Vyro_Business_Paradox.Calculate_OPD_Balance`(5184, CURRENT_DATE()) AS Current_Balance;

-- Get OPD balance as of a specific date
-- SELECT `test-imagine-web.Vyro_Business_Paradox.Calculate_OPD_Balance`(5184, DATE('2025-06-01')) AS Balance_As_Of_June;

-- Get balances for all employees
-- SELECT 
--     Employee_ID,
--     `test-imagine-web.Vyro_Business_Paradox.Calculate_OPD_Balance`(Employee_ID, CURRENT_DATE()) AS Current_Balance
-- FROM `test-imagine-web.Vyro_Business_Paradox.Employees`
-- WHERE Employment_Status = 'Active';

