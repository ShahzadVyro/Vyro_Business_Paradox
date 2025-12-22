-- ============================================================================
-- Employee Access Grants Fact Table
-- ============================================================================
-- Tracks access permissions over time
-- Supports access level changes and revocation history
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Table: Employee_Access_Grants
--
-- Created: January 2025
-- ============================================================================

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.Employee_Access_Grants` (
    Grant_ID INT64 NOT NULL OPTIONS(description="Unique grant identifier"),
    Employee_ID INT64 NOT NULL OPTIONS(description="Employee ID (FK to Employees)"),
    Platform_ID INT64 NOT NULL OPTIONS(description="Platform ID (FK to Access_Platforms)"),
    Access_Level STRING OPTIONS(description="Access level (Admin/Editor/Viewer/Custom/etc)"),
    Granted_Date DATE NOT NULL OPTIONS(description="Date access was granted"),
    Revoked_Date DATE OPTIONS(description="Date access was revoked (NULL if still active)"),
    Granted_By STRING OPTIONS(description="User who granted access"),
    Revoked_By STRING OPTIONS(description="User who revoked access"),
    Status STRING NOT NULL OPTIONS(description="Grant status (Active/Revoked/Expired/Suspended)"),
    Reason STRING OPTIONS(description="Reason for grant/revocation"),
    Notes STRING OPTIONS(description="Additional notes"),
    
    -- System Fields
    Created_At TIMESTAMP OPTIONS(description="Record creation timestamp"),
    Updated_At TIMESTAMP OPTIONS(description="Last update timestamp")
)
PARTITION BY Granted_Date
CLUSTER BY Employee_ID, Platform_ID
OPTIONS(
    description="Access permission history - tracks which employees have access to which platforms over time",
    labels=[("subject", "access"), ("version", "1")]
);

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get current active access for an employee
-- SELECT 
--     p.Platform_Name,
--     p.Category,
--     g.Access_Level,
--     g.Granted_Date,
--     g.Granted_By
-- FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Access_Grants` g
-- JOIN `test-imagine-web.Vyro_Business_Paradox.Access_Platforms` p ON g.Platform_ID = p.Platform_ID
-- WHERE g.Employee_ID = 5395
--   AND g.Status = 'Active'
--   AND g.Revoked_Date IS NULL
-- ORDER BY p.Category, p.Platform_Name;

-- Get all employees with access to a specific platform
-- SELECT 
--     e.Full_Name,
--     e.Official_Email,
--     g.Access_Level,
--     g.Granted_Date,
--     g.Status
-- FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Access_Grants` g
-- JOIN `test-imagine-web.Vyro_Business_Paradox.Employees` e ON g.Employee_ID = e.Employee_ID
-- WHERE g.Platform_ID = 1
--   AND g.Status = 'Active'
-- ORDER BY e.Full_Name;

-- Access audit: Find employees with admin access
-- SELECT 
--     e.Full_Name,
--     p.Platform_Name,
--     g.Access_Level,
--     g.Granted_Date,
--     g.Granted_By
-- FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Access_Grants` g
-- JOIN `test-imagine-web.Vyro_Business_Paradox.Employees` e ON g.Employee_ID = e.Employee_ID
-- JOIN `test-imagine-web.Vyro_Business_Paradox.Access_Platforms` p ON g.Platform_ID = p.Platform_ID
-- WHERE g.Access_Level LIKE '%Admin%'
--   AND g.Status = 'Active'
-- ORDER BY p.Platform_Name, e.Full_Name;


