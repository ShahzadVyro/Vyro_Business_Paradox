-- ============================================================================
-- Access Platforms Dimension Table
-- ============================================================================
-- Platform catalog for tracking access management
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
-- Table: Access_Platforms
--
-- Created: January 2025
-- ============================================================================

CREATE TABLE IF NOT EXISTS `test-imagine-web.Vyro_Business_Paradox.Access_Platforms` (
    Platform_ID INT64 NOT NULL OPTIONS(description="Unique platform identifier"),
    Platform_Name STRING NOT NULL OPTIONS(description="Platform name"),
    Category STRING OPTIONS(description="Platform category (Cloud/SaaS/Internal/Development/etc)"),
    Vendor STRING OPTIONS(description="Vendor/provider name"),
    Description STRING OPTIONS(description="Platform description"),
    URL STRING OPTIONS(description="Platform URL"),
    Requires_Approval BOOL OPTIONS(description="Whether access requires approval"),
    Approval_Workflow STRING OPTIONS(description="Approval workflow description"),
    
    -- System Fields
    Created_At TIMESTAMP OPTIONS(description="Record creation timestamp"),
    Updated_At TIMESTAMP OPTIONS(description="Last update timestamp"),
    Created_By STRING OPTIONS(description="User who created record"),
    Updated_By STRING OPTIONS(description="User who last updated record"),
    Is_Deleted BOOL OPTIONS(description="Soft delete flag")
)
CLUSTER BY Category, Platform_Name
OPTIONS(
    description="Platform catalog for access management",
    labels=[("subject", "access"), ("version", "1")]
);

-- ============================================================================
-- SAMPLE QUERIES
-- ============================================================================

-- Get all platforms by category
-- SELECT 
--     Category,
--     Platform_Name,
--     Vendor
-- FROM `test-imagine-web.Vyro_Business_Paradox.Access_Platforms`
-- WHERE Is_Deleted IS NULL OR Is_Deleted = FALSE
-- ORDER BY Category, Platform_Name;

-- Platforms requiring approval
-- SELECT 
--     Platform_Name,
--     Category,
--     Approval_Workflow
-- FROM `test-imagine-web.Vyro_Business_Paradox.Access_Platforms`
-- WHERE Requires_Approval = TRUE
--   AND (Is_Deleted IS NULL OR Is_Deleted = FALSE)
-- ORDER BY Category, Platform_Name;


