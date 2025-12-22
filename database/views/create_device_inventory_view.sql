-- ============================================================================
-- Device Inventory View
-- ============================================================================
-- Current device assignments, available devices, and device utilization metrics
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- View: Device_Inventory_View
--
-- Created: January 2025
-- ============================================================================

CREATE OR REPLACE VIEW `test-imagine-web.Vyro_Business_Paradox.Device_Inventory_View` AS
SELECT 
    d.Device_ID,
    d.Device_Type,
    d.Model,
    d.Serial_Number,
    d.Manufacturer,
    d.Status as Device_Status,
    d.Location,
    
    -- Current assignment info
    da.Employee_ID,
    e.Full_Name as Assigned_To,
    e.Department,
    da.Assigned_Date,
    da.Assignment_Status,
    DATE_DIFF(CURRENT_DATE(), da.Assigned_Date, DAY) as Days_Assigned,
    
    -- Assignment history count
    (SELECT COUNT(*) 
     FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Device_Assignments` da2
     WHERE da2.Device_ID = d.Device_ID) as Total_Assignments_Count

FROM `test-imagine-web.Vyro_Business_Paradox.Devices` d
LEFT JOIN `test-imagine-web.Vyro_Business_Paradox.Employee_Device_Assignments` da 
    ON d.Device_ID = da.Device_ID 
    AND da.Assignment_Status = 'Active' 
    AND da.Returned_Date IS NULL
LEFT JOIN `test-imagine-web.Vyro_Business_Paradox.Employees` e 
    ON da.Employee_ID = e.Employee_ID
WHERE d.Is_Deleted IS NULL OR d.Is_Deleted = FALSE
ORDER BY d.Device_Type, d.Status, e.Full_Name;

-- Available Devices View
CREATE OR REPLACE VIEW `test-imagine-web.Vyro_Business_Paradox.Available_Devices_View` AS
SELECT 
    d.*
FROM `test-imagine-web.Vyro_Business_Paradox.Devices` d
LEFT JOIN `test-imagine-web.Vyro_Business_Paradox.Employee_Device_Assignments` da 
    ON d.Device_ID = da.Device_ID 
    AND da.Assignment_Status = 'Active' 
    AND da.Returned_Date IS NULL
WHERE da.Assignment_ID IS NULL
  AND d.Status = 'Available'
  AND (d.Is_Deleted IS NULL OR d.Is_Deleted = FALSE)
ORDER BY d.Device_Type, d.Model;

-- Device Utilization Metrics
CREATE OR REPLACE VIEW `test-imagine-web.Vyro_Business_Paradox.Device_Utilization_Metrics` AS
SELECT 
    d.Device_Type,
    COUNT(DISTINCT d.Device_ID) as Total_Devices,
    COUNT(DISTINCT CASE WHEN d.Status = 'Available' THEN d.Device_ID END) as Available_Devices,
    COUNT(DISTINCT CASE WHEN d.Status = 'Assigned' THEN d.Device_ID END) as Assigned_Devices,
    COUNT(DISTINCT CASE WHEN d.Status = 'Retired' THEN d.Device_ID END) as Retired_Devices,
    ROUND(COUNT(DISTINCT CASE WHEN d.Status = 'Assigned' THEN d.Device_ID END) * 100.0 / 
          NULLIF(COUNT(DISTINCT CASE WHEN d.Status IN ('Available', 'Assigned') THEN d.Device_ID END), 0), 2) as Utilization_Percent
FROM `test-imagine-web.Vyro_Business_Paradox.Devices` d
WHERE d.Is_Deleted IS NULL OR d.Is_Deleted = FALSE
GROUP BY d.Device_Type
ORDER BY Utilization_Percent DESC;

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Current device assignments
-- SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.Device_Inventory_View`
-- WHERE Assignment_Status = 'Active'
-- ORDER BY Device_Type, Assigned_To;

-- Available devices
-- SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.Available_Devices_View`
-- WHERE Device_Type = 'Laptop';

-- Device utilization by type
-- SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.Device_Utilization_Metrics`
-- ORDER BY Utilization_Percent DESC;


