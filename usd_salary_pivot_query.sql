-- ============================================================================
-- USD Salary Pivot Query
-- ============================================================================
-- This query pivots the USD salary data to show Gross Income for each month
-- as separate columns (Jan, Feb, Mar, Apr, May, June, July, Aug, Sep, Oct)
-- ============================================================================

SELECT 
    -- Use the first non-null Key for each employee
    MAX(Key) AS Key,
    Employee_ID,
    Employee_Name,
    -- Normalize Status: '1' or NULL/empty should be 'Active'
    CASE 
        WHEN MAX(COALESCE(CAST(Status AS STRING), '')) IN ('1', '') 
             OR MAX(Status) IS NULL 
        THEN 'Active'
        ELSE MAX(CAST(Status AS STRING))
    END AS Empl_Status,
    -- Pivot Gross Income by Month
    MAX(CASE WHEN Month = 'Jan' THEN Gross_Income END) AS Jan,
    MAX(CASE WHEN Month = 'Feb' THEN Gross_Income END) AS Feb,
    MAX(CASE WHEN Month = 'Mar' THEN Gross_Income END) AS Mar,
    MAX(CASE WHEN Month = 'Apr' THEN Gross_Income END) AS Apr,
    MAX(CASE WHEN Month = 'May' THEN Gross_Income END) AS May,
    MAX(CASE WHEN Month = 'June' THEN Gross_Income END) AS June,
    MAX(CASE WHEN Month = 'July' THEN Gross_Income END) AS July,
    MAX(CASE WHEN Month = 'Aug' THEN Gross_Income END) AS Aug,
    MAX(CASE WHEN Month = 'Sep' THEN Gross_Income END) AS Sep,
    MAX(CASE WHEN Month = 'Oct' THEN Gross_Income END) AS Oct
FROM 
    `test-imagine-web.Vyro_Business_Paradox.Combined-USD_2025`
WHERE 
    Month IN ('Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sep', 'Oct')
    AND Employee_ID IS NOT NULL
    AND Month IS NOT NULL
    AND Month != 'Month'  -- Exclude header rows
GROUP BY 
    Employee_ID,
    Employee_Name
ORDER BY 
    Employee_ID;

