-- ============================================================================
-- Employee Profile View
-- ============================================================================
-- Unified employee profile view joining Employees with latest status, 
-- current devices, and active access
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- View: Employee_Profile_View
--
-- Created: January 2025
-- ============================================================================

CREATE OR REPLACE VIEW `test-imagine-web.Vyro_Business_Paradox.Employee_Profile_View` AS
SELECT 
    e.*,
    
    -- Latest lifecycle status
    (SELECT Lifecycle_Status 
     FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Lifecycle_Events` le
     WHERE le.Employee_ID = e.Employee_ID
     ORDER BY le.Event_Date DESC
     LIMIT 1) AS Latest_Lifecycle_Status,
    
    -- Current employment status
    (SELECT Status 
     FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Status_History` sh
     WHERE sh.Employee_ID = e.Employee_ID
       AND sh.End_Date IS NULL
     ORDER BY sh.Effective_Date DESC
     LIMIT 1) AS Current_Employment_Status,
    
    -- Current devices (comma-separated)
    (SELECT STRING_AGG(CONCAT(d.Device_Type, ' - ', d.Model), ', ')
     FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Device_Assignments` da
     JOIN `test-imagine-web.Vyro_Business_Paradox.Devices` d ON da.Device_ID = d.Device_ID
     WHERE da.Employee_ID = e.Employee_ID
       AND da.Assignment_Status = 'Active'
       AND da.Returned_Date IS NULL) AS Current_Devices,
    
    -- Active platforms (comma-separated)
    (SELECT STRING_AGG(p.Platform_Name, ', ')
     FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Access_Grants` ag
     JOIN `test-imagine-web.Vyro_Business_Paradox.Access_Platforms` p ON ag.Platform_ID = p.Platform_ID
     WHERE ag.Employee_ID = e.Employee_ID
       AND ag.Status = 'Active'
       AND ag.Revoked_Date IS NULL) AS Active_Platforms,
    
    -- Latest salary info
    (SELECT Gross_Income 
     FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries` s
     WHERE s.Employee_ID = e.Employee_ID
     ORDER BY s.Payroll_Month DESC
     LIMIT 1) AS Latest_Gross_Income,
    
    (SELECT Net_Income 
     FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries` s
     WHERE s.Employee_ID = e.Employee_ID
     ORDER BY s.Payroll_Month DESC
     LIMIT 1) AS Latest_Net_Income,
    
    (SELECT Currency 
     FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries` s
     WHERE s.Employee_ID = e.Employee_ID
     ORDER BY s.Payroll_Month DESC
     LIMIT 1) AS Latest_Salary_Currency

FROM `test-imagine-web.Vyro_Business_Paradox.Employees` e
WHERE e.Is_Deleted IS NULL OR e.Is_Deleted = FALSE;

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get complete employee profile
-- SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Profile_View`
-- WHERE Employee_ID = 5395;

-- Get all active employees with their devices and access
-- SELECT 
--     Employee_ID,
--     Full_Name,
--     Official_Email,
--     Department,
--     Designation,
--     Current_Devices,
--     Active_Platforms
-- FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Profile_View`
-- WHERE Current_Employment_Status = 'Active'
-- ORDER BY Full_Name;


