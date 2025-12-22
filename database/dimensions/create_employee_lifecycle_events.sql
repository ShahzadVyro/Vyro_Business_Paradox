-- ============================================================================
-- Employee Lifecycle Events Table
-- ============================================================================
-- Tracks lifecycle status changes over time for onboarding and employee journey
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Table: Employee_Lifecycle_Events
--
-- Created: January 2025
-- ============================================================================

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.Employee_Lifecycle_Events` (
    Event_ID INT64 NOT NULL OPTIONS(description="Unique event identifier"),
    Employee_ID INT64 NOT NULL OPTIONS(description="Employee ID (FK to Employees)"),
    Lifecycle_Status STRING NOT NULL OPTIONS(description="Lifecycle status at this event"),
    Event_Date TIMESTAMP NOT NULL OPTIONS(description="When this event occurred"),
    Event_By STRING OPTIONS(description="User/system that triggered this event"),
    Notes STRING OPTIONS(description="Additional notes about this event"),
    Created_At TIMESTAMP OPTIONS(description="Record creation timestamp")
)
CLUSTER BY Employee_ID, Event_Date
OPTIONS(
    description="Tracks employee lifecycle status changes over time (onboarding journey)",
    labels=[("subject", "lifecycle"), ("version", "1")]
);

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get employee onboarding timeline
-- SELECT 
--     e.Full_Name,
--     le.Lifecycle_Status,
--     le.Event_Date,
--     le.Event_By,
--     le.Notes
-- FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Lifecycle_Events` le
-- JOIN `test-imagine-web.Vyro_Business_Paradox.Employees` e ON le.Employee_ID = e.Employee_ID
-- WHERE le.Employee_ID = 5395
-- ORDER BY le.Event_Date;

-- Find employees stuck in onboarding
-- SELECT 
--     e.Employee_ID,
--     e.Full_Name,
--     e.Lifecycle_Status,
--     MAX(le.Event_Date) as Last_Event_Date,
--     DATE_DIFF(CURRENT_DATE(), DATE(MAX(le.Event_Date)), DAY) as Days_Since_Last_Event
-- FROM `test-imagine-web.Vyro_Business_Paradox.Employees` e
-- LEFT JOIN `test-imagine-web.Vyro_Business_Paradox.Employee_Lifecycle_Events` le ON e.Employee_ID = le.Employee_ID
-- WHERE e.Lifecycle_Status IN ('Form_Submitted', 'Data_Added', 'Email_Created', 'Employee_ID_Assigned')
-- GROUP BY e.Employee_ID, e.Full_Name, e.Lifecycle_Status
-- HAVING Days_Since_Last_Event > 7
-- ORDER BY Days_Since_Last_Event DESC;


