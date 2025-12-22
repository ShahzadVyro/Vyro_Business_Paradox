-- ============================================================================
-- Employee Status History Table
-- ============================================================================
-- Tracks employment status changes over time (Active → Resigned → Rejoined)
-- Supports SCD Type 2 for historical queries
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Table: Employee_Status_History
--
-- Created: January 2025
-- ============================================================================

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.Employee_Status_History` (
    History_ID INT64 NOT NULL OPTIONS(description="Unique history record identifier"),
    Employee_ID INT64 NOT NULL OPTIONS(description="Employee ID (FK to Employees)"),
    Status STRING NOT NULL OPTIONS(description="Employment status (Active/Resigned/Terminated/On Leave)"),
    Effective_Date DATE NOT NULL OPTIONS(description="When this status became effective"),
    End_Date DATE OPTIONS(description="When this status ended (NULL if current)"),
    Reason STRING OPTIONS(description="Reason for status change"),
    Changed_By STRING OPTIONS(description="User who made this change"),
    Created_At TIMESTAMP OPTIONS(description="Record creation timestamp")
)
CLUSTER BY Employee_ID, Effective_Date
OPTIONS(
    description="Historical tracking of employment status changes (SCD Type 2)",
    labels=[("subject", "status_history"), ("version", "1")]
);

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get current status for an employee
-- SELECT 
--     e.Full_Name,
--     h.Status,
--     h.Effective_Date,
--     h.Reason
-- FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Status_History` h
-- JOIN `test-imagine-web.Vyro_Business_Paradox.Employees` e ON h.Employee_ID = e.Employee_ID
-- WHERE h.Employee_ID = 5395
--   AND h.End_Date IS NULL
-- ORDER BY h.Effective_Date DESC
-- LIMIT 1;

-- Get complete status history for an employee
-- SELECT 
--     Status,
--     Effective_Date,
--     End_Date,
--     Reason,
--     Changed_By
-- FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Status_History`
-- WHERE Employee_ID = 5395
-- ORDER BY Effective_Date;

-- Find employees who rejoined
-- SELECT 
--     e.Employee_ID,
--     e.Full_Name,
--     COUNT(*) as Status_Changes,
--     COUNTIF(Status = 'Active') as Active_Periods
-- FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Status_History` h
-- JOIN `test-imagine-web.Vyro_Business_Paradox.Employees` e ON h.Employee_ID = e.Employee_ID
-- GROUP BY e.Employee_ID, e.Full_Name
-- HAVING Active_Periods > 1;


