-- ============================================================================
-- Employee Device Assignments Fact Table
-- ============================================================================
-- Tracks device assignments over time
-- Supports multiple devices per employee and device reassignment history
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Table: Employee_Device_Assignments
--
-- Created: January 2025
-- ============================================================================

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.Employee_Device_Assignments` (
    Assignment_ID INT64 NOT NULL OPTIONS(description="Unique assignment identifier"),
    Employee_ID INT64 NOT NULL OPTIONS(description="Employee ID (FK to Employees)"),
    Device_ID INT64 NOT NULL OPTIONS(description="Device ID (FK to Devices)"),
    Assigned_Date DATE NOT NULL OPTIONS(description="Date device was assigned"),
    Returned_Date DATE OPTIONS(description="Date device was returned (NULL if still assigned)"),
    Assignment_Status STRING NOT NULL OPTIONS(description="Assignment status (Active/Returned/Lost/Damaged)"),
    Assigned_By STRING OPTIONS(description="User who assigned the device"),
    Returned_To STRING OPTIONS(description="User who received the returned device"),
    Notes STRING OPTIONS(description="Additional notes about assignment"),
    
    -- System Fields
    Created_At TIMESTAMP OPTIONS(description="Record creation timestamp"),
    Updated_At TIMESTAMP OPTIONS(description="Last update timestamp")
)
PARTITION BY Assigned_Date
CLUSTER BY Employee_ID, Device_ID
OPTIONS(
    description="Device assignment history - tracks which devices are assigned to which employees over time",
    labels=[("subject", "devices"), ("version", "1")]
);

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get current device assignments
-- SELECT 
--     e.Full_Name,
--     d.Device_Type,
--     d.Model,
--     d.Serial_Number,
--     a.Assigned_Date,
--     a.Assignment_Status
-- FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Device_Assignments` a
-- JOIN `test-imagine-web.Vyro_Business_Paradox.Employees` e ON a.Employee_ID = e.Employee_ID
-- JOIN `test-imagine-web.Vyro_Business_Paradox.Devices` d ON a.Device_ID = d.Device_ID
-- WHERE a.Assignment_Status = 'Active' AND a.Returned_Date IS NULL
-- ORDER BY e.Full_Name;

-- Get device assignment history for an employee
-- SELECT 
--     d.Device_Type,
--     d.Model,
--     a.Assigned_Date,
--     a.Returned_Date,
--     a.Assignment_Status
-- FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Device_Assignments` a
-- JOIN `test-imagine-web.Vyro_Business_Paradox.Devices` d ON a.Device_ID = d.Device_ID
-- WHERE a.Employee_ID = 5395
-- ORDER BY a.Assigned_Date DESC;

-- Find unassigned devices
-- SELECT 
--     d.*
-- FROM `test-imagine-web.Vyro_Business_Paradox.Devices` d
-- LEFT JOIN `test-imagine-web.Vyro_Business_Paradox.Employee_Device_Assignments` a 
--     ON d.Device_ID = a.Device_ID 
--     AND a.Assignment_Status = 'Active' 
--     AND a.Returned_Date IS NULL
-- WHERE a.Assignment_ID IS NULL
--   AND d.Status = 'Available'
--   AND (d.Is_Deleted IS NULL OR d.Is_Deleted = FALSE);


