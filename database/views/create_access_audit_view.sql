-- ============================================================================
-- Access Audit View
-- ============================================================================
-- Current access permissions by employee, access by platform
-- Compliance and security audit queries
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- View: Access_Audit_View
--
-- Created: January 2025
-- ============================================================================

CREATE OR REPLACE VIEW `test-imagine-web.Vyro_Business_Paradox.Access_Audit_View` AS
SELECT 
    e.Employee_ID,
    e.Full_Name,
    e.Official_Email,
    e.Department,
    e.Designation,
    e.Employment_Status,
    e.Employment_End_Date,
    
    -- Access details
    ag.Platform_ID,
    p.Platform_Name,
    p.Category as Platform_Category,
    p.Vendor,
    ag.Access_Level,
    ag.Granted_Date,
    ag.Revoked_Date,
    ag.Status as Grant_Status,
    ag.Granted_By,
    DATE_DIFF(CURRENT_DATE(), ag.Granted_Date, DAY) as Days_Since_Granted,
    
    -- Risk indicators
    CASE 
        WHEN e.Employment_Status IN ('Resigned', 'Terminated') AND ag.Status = 'Active' THEN 'HIGH'
        WHEN ag.Access_Level LIKE '%Admin%' THEN 'MEDIUM'
        WHEN DATE_DIFF(CURRENT_DATE(), ag.Granted_Date, DAY) > 365 THEN 'MEDIUM'
        ELSE 'LOW'
    END as Risk_Level

FROM `test-imagine-web.Vyro_Business_Paradox.Employees` e
JOIN `test-imagine-web.Vyro_Business_Paradox.Employee_Access_Grants` ag ON e.Employee_ID = ag.Employee_ID
JOIN `test-imagine-web.Vyro_Business_Paradox.Access_Platforms` p ON ag.Platform_ID = p.Platform_ID
WHERE (e.Is_Deleted IS NULL OR e.Is_Deleted = FALSE)
ORDER BY e.Full_Name, p.Platform_Name;

-- Access by Platform Summary
CREATE OR REPLACE VIEW `test-imagine-web.Vyro_Business_Paradox.Access_By_Platform_Summary` AS
SELECT 
    p.Platform_ID,
    p.Platform_Name,
    p.Category,
    p.Vendor,
    COUNT(DISTINCT ag.Employee_ID) as Total_Users,
    COUNT(DISTINCT CASE WHEN ag.Status = 'Active' AND ag.Revoked_Date IS NULL THEN ag.Employee_ID END) as Active_Users,
    COUNT(DISTINCT CASE WHEN ag.Access_Level LIKE '%Admin%' THEN ag.Employee_ID END) as Admin_Users,
    MIN(ag.Granted_Date) as First_Grant_Date,
    MAX(ag.Granted_Date) as Latest_Grant_Date
FROM `test-imagine-web.Vyro_Business_Paradox.Access_Platforms` p
LEFT JOIN `test-imagine-web.Vyro_Business_Paradox.Employee_Access_Grants` ag ON p.Platform_ID = ag.Platform_ID
WHERE p.Is_Deleted IS NULL OR p.Is_Deleted = FALSE
GROUP BY p.Platform_ID, p.Platform_Name, p.Category, p.Vendor
ORDER BY Active_Users DESC;

-- Access Compliance Issues
CREATE OR REPLACE VIEW `test-imagine-web.Vyro_Business_Paradox.Access_Compliance_Issues` AS
SELECT 
    e.Employee_ID,
    e.Full_Name,
    e.Employment_Status,
    e.Employment_End_Date,
    p.Platform_Name,
    ag.Access_Level,
    ag.Granted_Date,
    ag.Status,
    CASE 
        WHEN e.Employment_Status IN ('Resigned', 'Terminated') AND ag.Status = 'Active' 
        THEN 'Terminated employee has active access'
        WHEN DATE_DIFF(CURRENT_DATE(), ag.Granted_Date, DAY) > 365 AND ag.Status = 'Active'
        THEN 'Access granted over 1 year ago - review needed'
        WHEN ag.Access_Level LIKE '%Admin%' AND DATE_DIFF(CURRENT_DATE(), ag.Granted_Date, DAY) > 90
        THEN 'Admin access granted over 90 days ago - review needed'
        ELSE NULL
    END as Issue_Description
FROM `test-imagine-web.Vyro_Business_Paradox.Employees` e
JOIN `test-imagine-web.Vyro_Business_Paradox.Employee_Access_Grants` ag ON e.Employee_ID = ag.Employee_ID
JOIN `test-imagine-web.Vyro_Business_Paradox.Access_Platforms` p ON ag.Platform_ID = p.Platform_ID
WHERE (e.Is_Deleted IS NULL OR e.Is_Deleted = FALSE)
  AND (
    (e.Employment_Status IN ('Resigned', 'Terminated') AND ag.Status = 'Active')
    OR (DATE_DIFF(CURRENT_DATE(), ag.Granted_Date, DAY) > 365 AND ag.Status = 'Active')
    OR (ag.Access_Level LIKE '%Admin%' AND DATE_DIFF(CURRENT_DATE(), ag.Granted_Date, DAY) > 90)
  )
ORDER BY e.Full_Name, p.Platform_Name;

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get all access for an employee
-- SELECT 
--     Platform_Name,
--     Access_Level,
--     Granted_Date,
--     Risk_Level
-- FROM `test-imagine-web.Vyro_Business_Paradox.Access_Audit_View`
-- WHERE Employee_ID = 5395
-- ORDER BY Risk_Level DESC, Platform_Name;

-- Access summary by platform
-- SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.Access_By_Platform_Summary`
-- ORDER BY Active_Users DESC;

-- Compliance issues
-- SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.Access_Compliance_Issues`
-- ORDER BY Issue_Description, Full_Name;

-- High-risk access (terminated employees with active access)
-- SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.Access_Audit_View`
-- WHERE Risk_Level = 'HIGH'
-- ORDER BY Full_Name;


