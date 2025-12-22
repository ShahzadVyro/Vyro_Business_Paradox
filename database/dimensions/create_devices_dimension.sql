-- ============================================================================
-- Devices Dimension Table
-- ============================================================================
-- Device catalog for tracking company devices
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Table: Devices
--
-- Created: January 2025
-- ============================================================================

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.Devices` (
    Device_ID INT64 NOT NULL OPTIONS(description="Unique device identifier"),
    Device_Type STRING NOT NULL OPTIONS(description="Device type (Laptop/Desktop/Phone/Tablet/etc)"),
    Model STRING OPTIONS(description="Device model"),
    Serial_Number STRING OPTIONS(description="Device serial number"),
    Manufacturer STRING OPTIONS(description="Device manufacturer"),
    Purchase_Date DATE OPTIONS(description="Purchase date"),
    Purchase_Price NUMERIC OPTIONS(description="Purchase price"),
    Status STRING NOT NULL OPTIONS(description="Device status (Available/Assigned/Retired/Lost/Repair)"),
    Location STRING OPTIONS(description="Current location"),
    Notes STRING OPTIONS(description="Additional notes"),
    
    -- System Fields
    Created_At TIMESTAMP OPTIONS(description="Record creation timestamp"),
    Updated_At TIMESTAMP OPTIONS(description="Last update timestamp"),
    Created_By STRING OPTIONS(description="User who created record"),
    Updated_By STRING OPTIONS(description="User who last updated record"),
    Is_Deleted BOOL OPTIONS(description="Soft delete flag")
)
CLUSTER BY Device_Type, Status
OPTIONS(
    description="Device catalog for company asset tracking",
    labels=[("subject", "devices"), ("version", "1")]
);

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get all available devices
-- SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.Devices`
-- WHERE Status = 'Available' AND (Is_Deleted IS NULL OR Is_Deleted = FALSE)
-- ORDER BY Device_Type, Model;

-- Device inventory by type
-- SELECT 
--     Device_Type,
--     Status,
--     COUNT(*) as Count
-- FROM `test-imagine-web.Vyro_Business_Paradox.Devices`
-- WHERE Is_Deleted IS NULL OR Is_Deleted = FALSE
-- GROUP BY Device_Type, Status
-- ORDER BY Device_Type, Status;


