-- ============================================================================
-- OPD Balance View
-- ============================================================================
-- Shows current OPD balance per employee, available balance for claiming,
-- and claim history
-- 
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- View: OPD_Balance_View
-- ============================================================================

CREATE OR REPLACE VIEW `test-imagine-web.Vyro_Business_Paradox.OPD_Balance_View` AS
WITH OPD_Summary AS (
    SELECT 
        Employee_ID,
        SUM(COALESCE(Contribution_Amount, 0)) AS Total_Contributions,
        SUM(COALESCE(Claimed_Amount, 0)) AS Total_Claimed,
        SUM(COALESCE(Contribution_Amount, 0)) - SUM(COALESCE(Claimed_Amount, 0)) AS Current_Balance,
        MIN(Benefit_Month) AS First_Contribution_Month,
        MAX(Benefit_Month) AS Last_Contribution_Month,
        COUNT(DISTINCT Benefit_Month) AS Months_Contributed,
        MAX(Is_Active) AS Is_Active
    FROM 
        `test-imagine-web.Vyro_Business_Paradox.Employee_OPD_Benefits`
    GROUP BY 
        Employee_ID
)
SELECT 
    e.Employee_ID,
    e.Full_Name,
    e.Designation,
    e.Department,
    e.Employment_Status,
    
    -- OPD Summary
    COALESCE(opd.Total_Contributions, 0) AS Total_OPD_Contributions,
    COALESCE(opd.Total_Claimed, 0) AS Total_OPD_Claimed,
    COALESCE(opd.Current_Balance, 0) AS Available_OPD_Balance,
    opd.First_Contribution_Month,
    opd.Last_Contribution_Month,
    opd.Months_Contributed,
    
    -- Eligibility
    CASE 
        WHEN e.Employment_Status = 'Active' 
         AND EXISTS (
             SELECT 1 
             FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries` s
             WHERE s.Employee_ID = e.Employee_ID
               AND s.Currency = 'PKR'
             LIMIT 1
         )
        THEN TRUE
        ELSE FALSE
    END AS Is_Eligible_For_OPD,
    
    opd.Is_Active AS OPD_Active_Status,
    
    -- Latest claim info
    (
        SELECT Claimed_Amount
        FROM `test-imagine-web.Vyro_Business_Paradox.Employee_OPD_Benefits` opd2
        WHERE opd2.Employee_ID = e.Employee_ID
          AND opd2.Claimed_Amount IS NOT NULL
          AND opd2.Claimed_Amount > 0
        ORDER BY opd2.Benefit_Month DESC
        LIMIT 1
    ) AS Latest_Claim_Amount,
    
    (
        SELECT Benefit_Month
        FROM `test-imagine-web.Vyro_Business_Paradox.Employee_OPD_Benefits` opd2
        WHERE opd2.Employee_ID = e.Employee_ID
          AND opd2.Claimed_Amount IS NOT NULL
          AND opd2.Claimed_Amount > 0
        ORDER BY opd2.Benefit_Month DESC
        LIMIT 1
    ) AS Latest_Claim_Month,
    
    -- Comments
    (
        SELECT Comments
        FROM `test-imagine-web.Vyro_Business_Paradox.Employee_OPD_Benefits` opd2
        WHERE opd2.Employee_ID = e.Employee_ID
          AND opd2.Comments IS NOT NULL
        ORDER BY opd2.Benefit_Month DESC
        LIMIT 1
    ) AS Latest_Comments
FROM 
    `test-imagine-web.Vyro_Business_Paradox.Employees` e
LEFT JOIN 
    OPD_Summary opd ON e.Employee_ID = opd.Employee_ID
WHERE 
    -- Show employees who have OPD records or are PKR salaried
    opd.Employee_ID IS NOT NULL
    OR EXISTS (
        SELECT 1 
        FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries` s
        WHERE s.Employee_ID = e.Employee_ID
          AND s.Currency = 'PKR'
        LIMIT 1
    );


