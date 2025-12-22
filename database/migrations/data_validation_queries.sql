-- ============================================================================
-- Data Validation Queries
-- ============================================================================
-- Queries to validate data integrity, referential integrity, and data quality
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
--
-- Created: January 2025
-- ============================================================================

-- ============================================================================
-- REFERENTIAL INTEGRITY CHECKS
-- ============================================================================

-- Check for orphaned salary records (Employee_ID not in Employees table)
SELECT 
    'Orphaned Salary Records' as Check_Type,
    COUNT(*) as Issue_Count
FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries` s
LEFT JOIN `test-imagine-web.Vyro_Business_Paradox.Employees` e ON s.Employee_ID = e.Employee_ID
WHERE e.Employee_ID IS NULL;

-- Check for orphaned EOBI records
SELECT 
    'Orphaned EOBI Records' as Check_Type,
    COUNT(*) as Issue_Count
FROM `test-imagine-web.Vyro_Business_Paradox.Employee_EOBI` eobi
LEFT JOIN `test-imagine-web.Vyro_Business_Paradox.Employees` e ON eobi.Employee_ID = e.Employee_ID
WHERE e.Employee_ID IS NULL;

-- Check for orphaned device assignments
SELECT 
    'Orphaned Device Assignments' as Check_Type,
    COUNT(*) as Issue_Count
FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Device_Assignments` da
LEFT JOIN `test-imagine-web.Vyro_Business_Paradox.Employees` e ON da.Employee_ID = e.Employee_ID
WHERE e.Employee_ID IS NULL;

-- Check for orphaned access grants
SELECT 
    'Orphaned Access Grants' as Check_Type,
    COUNT(*) as Issue_Count
FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Access_Grants` ag
LEFT JOIN `test-imagine-web.Vyro_Business_Paradox.Employees` e ON ag.Employee_ID = e.Employee_ID
WHERE e.Employee_ID IS NULL;

-- ============================================================================
-- DATA QUALITY CHECKS
-- ============================================================================

-- Employees missing critical fields
SELECT 
    'Missing Critical Fields' as Check_Type,
    Employee_ID,
    Full_Name,
    CASE 
        WHEN Official_Email IS NULL THEN 'Missing Official Email'
        WHEN Joining_Date IS NULL THEN 'Missing Joining Date'
        WHEN Department IS NULL THEN 'Missing Department'
        WHEN Designation IS NULL THEN 'Missing Designation'
        WHEN CNIC_ID IS NULL THEN 'Missing CNIC'
        ELSE 'OK'
    END as Issue
FROM `test-imagine-web.Vyro_Business_Paradox.Employees`
WHERE Official_Email IS NULL 
   OR Joining_Date IS NULL
   OR Department IS NULL
   OR Designation IS NULL
   OR CNIC_ID IS NULL
ORDER BY Employee_ID;

-- Duplicate Employee_IDs (should be zero)
SELECT 
    'Duplicate Employee_IDs' as Check_Type,
    Employee_ID,
    COUNT(*) as Count
FROM `test-imagine-web.Vyro_Business_Paradox.Employees`
GROUP BY Employee_ID
HAVING COUNT(*) > 1;

-- Employees with invalid lifecycle status transitions
SELECT 
    'Invalid Lifecycle Status' as Check_Type,
    e.Employee_ID,
    e.Full_Name,
    e.Lifecycle_Status,
    e.Employment_Status
FROM `test-imagine-web.Vyro_Business_Paradox.Employees` e
WHERE (e.Lifecycle_Status = 'Active' AND e.Employment_Status IN ('Resigned', 'Terminated'))
   OR (e.Lifecycle_Status IN ('Resigned', 'Terminated') AND e.Employment_Status = 'Active')
ORDER BY e.Employee_ID;

-- ============================================================================
-- SALARY DATA VALIDATION
-- ============================================================================

-- Salary records with negative amounts (should be zero or positive)
SELECT 
    'Negative Salary Amounts' as Check_Type,
    COUNT(*) as Issue_Count
FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries`
WHERE Gross_Income < 0 OR Net_Income < 0;

-- Salary records where Net > Gross (should not happen)
SELECT 
    'Net Income > Gross Income' as Check_Type,
    COUNT(*) as Issue_Count
FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries`
WHERE Net_Income > Gross_Income;

-- Missing salary data for active employees
SELECT 
    'Missing Salary Data' as Check_Type,
    e.Employee_ID,
    e.Full_Name,
    e.Employment_Status
FROM `test-imagine-web.Vyro_Business_Paradox.Employees` e
LEFT JOIN `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries` s ON e.Employee_ID = s.Employee_ID
WHERE e.Employment_Status = 'Active'
  AND s.Salary_ID IS NULL
ORDER BY e.Employee_ID;

-- ============================================================================
-- DEVICE ASSIGNMENT VALIDATION
-- ============================================================================

-- Devices assigned to inactive employees
SELECT 
    'Devices Assigned to Inactive Employees' as Check_Type,
    da.Employee_ID,
    e.Full_Name,
    e.Employment_Status,
    d.Device_Type,
    d.Model
FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Device_Assignments` da
JOIN `test-imagine-web.Vyro_Business_Paradox.Employees` e ON da.Employee_ID = e.Employee_ID
JOIN `test-imagine-web.Vyro_Business_Paradox.Devices` d ON da.Device_ID = d.Device_ID
WHERE da.Assignment_Status = 'Active'
  AND da.Returned_Date IS NULL
  AND e.Employment_Status IN ('Resigned', 'Terminated');

-- ============================================================================
-- ACCESS GRANT VALIDATION
-- ============================================================================

-- Active access grants for terminated employees
SELECT 
    'Active Access for Terminated Employees' as Check_Type,
    ag.Employee_ID,
    e.Full_Name,
    e.Employment_Status,
    p.Platform_Name,
    ag.Access_Level
FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Access_Grants` ag
JOIN `test-imagine-web.Vyro_Business_Paradox.Employees` e ON ag.Employee_ID = e.Employee_ID
JOIN `test-imagine-web.Vyro_Business_Paradox.Access_Platforms` p ON ag.Platform_ID = p.Platform_ID
WHERE ag.Status = 'Active'
  AND ag.Revoked_Date IS NULL
  AND e.Employment_Status IN ('Resigned', 'Terminated');

-- ============================================================================
-- LIFECYCLE STATUS VALIDATION
-- ============================================================================

-- Employees stuck in onboarding (no activity for 30+ days)
SELECT 
    'Stuck in Onboarding' as Check_Type,
    e.Employee_ID,
    e.Full_Name,
    e.Lifecycle_Status,
    MAX(le.Event_Date) as Last_Event_Date,
    DATE_DIFF(CURRENT_DATE(), DATE(MAX(le.Event_Date)), DAY) as Days_Since_Last_Event
FROM `test-imagine-web.Vyro_Business_Paradox.Employees` e
LEFT JOIN `test-imagine-web.Vyro_Business_Paradox.Employee_Lifecycle_Events` le ON e.Employee_ID = le.Employee_ID
WHERE e.Lifecycle_Status IN ('Form_Submitted', 'Data_Added', 'Email_Created', 'Employee_ID_Assigned')
GROUP BY e.Employee_ID, e.Full_Name, e.Lifecycle_Status
HAVING Days_Since_Last_Event > 30
ORDER BY Days_Since_Last_Event DESC;

-- ============================================================================
-- SUMMARY REPORT
-- ============================================================================

-- Overall data quality summary
SELECT 
    'Data Quality Summary' as Report_Type,
    (SELECT COUNT(*) FROM `test-imagine-web.Vyro_Business_Paradox.Employees` WHERE Is_Deleted IS NULL OR Is_Deleted = FALSE) as Total_Employees,
    (SELECT COUNT(*) FROM `test-imagine-web.Vyro_Business_Paradox.Employees` WHERE Employment_Status = 'Active') as Active_Employees,
    (SELECT COUNT(*) FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries`) as Total_Salary_Records,
    (SELECT COUNT(DISTINCT Employee_ID) FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Salaries`) as Employees_With_Salary,
    (SELECT COUNT(*) FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Device_Assignments` WHERE Assignment_Status = 'Active' AND Returned_Date IS NULL) as Active_Device_Assignments,
    (SELECT COUNT(*) FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Access_Grants` WHERE Status = 'Active' AND Revoked_Date IS NULL) as Active_Access_Grants;


