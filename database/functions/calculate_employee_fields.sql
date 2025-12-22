-- ============================================================================
-- Calculated Employee Fields Functions
-- ============================================================================
-- SQL functions and views for calculated employee fields
--
-- Project: test-imagine-web
-- Dataset: Vyro_Business_Paradox
--
-- Created: January 2025
-- ============================================================================

-- ============================================================================
-- VIEW: Employees with Calculated Fields
-- ============================================================================
-- This view adds calculated fields to the Employees table

CREATE OR REPLACE VIEW `test-imagine-web.Vyro_Business_Paradox.Employees_With_Calculated_Fields` AS
SELECT 
    *,
    -- Probation End Date: Joining_Date + 3 months
    DATE_ADD(Joining_Date, INTERVAL 3 MONTH) AS Calculated_Probation_End_Date,
    
    -- IBFT/IFT: "IFT" if Bank_Name = "Meezan Bank", else "IBFT"
    CASE 
        WHEN UPPER(TRIM(Bank_Name)) = 'MEEZAN BANK' THEN 'IFT'
        WHEN Bank_Name IS NOT NULL AND Bank_Name != '' THEN 'IBFT'
        ELSE NULL
    END AS Calculated_IBFT_IFT,
    
    -- ACCOUNTNUMBER: Extract from Bank_Account_Number_IBAN (last part after spaces/dashes)
    REGEXP_EXTRACT(Bank_Account_Number_IBAN, r'[-\s]*([0-9]+)$') AS Calculated_ACCOUNTNUMBER,
    
    -- BANK_CODE: Extract from IBAN (first 4 characters after country code)
    CASE 
        WHEN Bank_Account_Number_IBAN IS NOT NULL AND LENGTH(Bank_Account_Number_IBAN) >= 6
        THEN SUBSTR(Bank_Account_Number_IBAN, 5, 4)
        ELSE NULL
    END AS Calculated_BANK_CODE,
    
    -- Key: Composite key: Father_Name + Employee_Name + CAST(Employee_ID AS STRING)
    CONCAT(
        COALESCE(Father_Name, ''),
        COALESCE(Full_Name, ''),
        CAST(Employee_ID AS STRING)
    ) AS Calculated_Key,
    
    -- Age: Calculate from Date_of_Birth
    DATE_DIFF(CURRENT_DATE(), Date_of_Birth, YEAR) AS Calculated_Age
    
FROM `test-imagine-web.Vyro_Business_Paradox.Employees`
WHERE Is_Deleted IS NULL OR Is_Deleted = FALSE;

-- ============================================================================
-- FUNCTION: Update Calculated Fields
-- ============================================================================
-- Note: BigQuery doesn't support stored procedures, so calculated fields
-- should be updated via UPDATE statements or computed in views

-- Example UPDATE statement to set Probation_End_Date:
-- UPDATE `test-imagine-web.Vyro_Business_Paradox.Employees`
-- SET Probation_End_Date = DATE_ADD(Joining_Date, INTERVAL 3 MONTH)
-- WHERE Probation_End_Date IS NULL AND Joining_Date IS NOT NULL;

-- Example UPDATE statement to set IBFT_IFT:
-- UPDATE `test-imagine-web.Vyro_Business_Paradox.Employees`
-- SET IBFT_IFT = CASE 
--     WHEN UPPER(TRIM(Bank_Name)) = 'MEEZAN BANK' THEN 'IFT'
--     WHEN Bank_Name IS NOT NULL AND Bank_Name != '' THEN 'IBFT'
--     ELSE NULL
-- END
-- WHERE IBFT_IFT IS NULL;

-- Example UPDATE statement to set Key:
-- UPDATE `test-imagine-web.Vyro_Business_Paradox.Employees`
-- SET Key = CONCAT(
--     COALESCE(Father_Name, ''),
--     COALESCE(Full_Name, ''),
--     CAST(Employee_ID AS STRING)
-- )
-- WHERE Key IS NULL;


