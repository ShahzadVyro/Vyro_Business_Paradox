-- ============================================================================
-- Onboarding Dashboard View
-- ============================================================================
-- Shows employees by Lifecycle_Status for onboarding tracking
-- Identifies bottlenecks in onboarding process
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- View: Onboarding_Dashboard_View
--
-- Created: January 2025
-- ============================================================================

CREATE OR REPLACE VIEW `test-imagine-web.Vyro_Business_Paradox.Onboarding_Dashboard_View` AS
SELECT 
    e.Employee_ID,
    e.Full_Name,
    e.Official_Email,
    e.Personal_Email,
    e.Lifecycle_Status,
    e.Joining_Date,
    e.Department,
    e.Designation,
    e.Recruiter_Name,
    
    -- Latest lifecycle event
    (SELECT Event_Date 
     FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Lifecycle_Events` le
     WHERE le.Employee_ID = e.Employee_ID
     ORDER BY le.Event_Date DESC
     LIMIT 1) AS Last_Lifecycle_Event_Date,
    
    -- Days since last event
    DATE_DIFF(CURRENT_DATE(), 
        (SELECT DATE(Event_Date) 
         FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Lifecycle_Events` le
         WHERE le.Employee_ID = e.Employee_ID
         ORDER BY le.Event_Date DESC
         LIMIT 1), 
        DAY) AS Days_Since_Last_Event,
    
    -- Days until joining
    DATE_DIFF(e.Joining_Date, CURRENT_DATE(), DAY) AS Days_Until_Joining,
    
    -- Form submission date
    e.Timestamp AS Form_Submitted_Date,
    
    -- Onboarding progress (based on lifecycle status)
    CASE 
        WHEN e.Lifecycle_Status = 'Form_Submitted' THEN 20
        WHEN e.Lifecycle_Status = 'Data_Added' THEN 40
        WHEN e.Lifecycle_Status = 'Email_Created' THEN 60
        WHEN e.Lifecycle_Status = 'Employee_ID_Assigned' THEN 80
        WHEN e.Lifecycle_Status = 'Onboarded' THEN 100
        WHEN e.Lifecycle_Status = 'Active' THEN 100
        ELSE 0
    END AS Onboarding_Progress_Percent

FROM `test-imagine-web.Vyro_Business_Paradox.Employees` e
WHERE (e.Is_Deleted IS NULL OR e.Is_Deleted = FALSE)
  AND e.Lifecycle_Status IN ('Form_Submitted', 'Data_Added', 'Email_Created', 'Employee_ID_Assigned', 'Onboarded')
ORDER BY e.Lifecycle_Status, e.Joining_Date;

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get employees stuck in onboarding (no activity for 7+ days)
-- SELECT 
--     Employee_ID,
--     Full_Name,
--     Lifecycle_Status,
--     Days_Since_Last_Event,
--     Days_Until_Joining
-- FROM `test-imagine-web.Vyro_Business_Paradox.Onboarding_Dashboard_View`
-- WHERE Days_Since_Last_Event > 7
-- ORDER BY Days_Since_Last_Event DESC;

-- Onboarding status summary
-- SELECT 
--     Lifecycle_Status,
--     COUNT(*) as Employee_Count,
--     AVG(Days_Since_Last_Event) as Avg_Days_Since_Last_Event,
--     AVG(Onboarding_Progress_Percent) as Avg_Progress_Percent
-- FROM `test-imagine-web.Vyro_Business_Paradox.Onboarding_Dashboard_View`
-- GROUP BY Lifecycle_Status
-- ORDER BY Avg_Progress_Percent;

-- Employees joining in next 7 days
-- SELECT 
--     Employee_ID,
--     Full_Name,
--     Joining_Date,
--     Lifecycle_Status,
--     Onboarding_Progress_Percent
-- FROM `test-imagine-web.Vyro_Business_Paradox.Onboarding_Dashboard_View`
-- WHERE Days_Until_Joining BETWEEN 0 AND 7
-- ORDER BY Joining_Date;


