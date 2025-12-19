# Probation Period Migration Guide

## Overview

This migration adds automatic probation period calculation (3 months) for all employees and fixes Employment_End_Date display issues.

## Prerequisites

Before running the data migration, you must add the missing columns to the Employees table.

## Step 1: Add Missing Columns

Run the SQL migration to add `Probation_Period_Months` and `Probation_Start_Date` columns:

```bash
python3 scripts/run_probation_columns_migration.py
```

Or manually execute the SQL file:

```bash
# In BigQuery console or using bq command-line tool
bq query --use_legacy_sql=false < database/add_probation_columns.sql
```

This will:

- Add `Probation_Period_Months INT64` column
- Add `Probation_Start_Date DATE` column

## Step 2: Run Diagnostic Script (Optional)

Check the current state of your data:

```bash
python3 scripts/check_employment_and_probation_dates.py
```

This will show:

- Column existence status
- Statistics on missing data
- Sample data for resigned/terminated employees

## Step 3: Run Data Migration

### Dry Run First (Recommended)

```bash
python3 scripts/migrate_employment_and_probation_dates.py --dry-run
```

This will show what would be updated without making any changes.

### Actual Migration

```bash
python3 scripts/migrate_employment_and_probation_dates.py
```

This will:

1. Backfill `Employment_End_Date` from Offboarding table (where NULL)
2. Set `Probation_Period_Months = 3` for all employees (where NULL)
3. Calculate `Probation_End_Date = DATE_ADD(Joining_Date, INTERVAL 3 MONTH)` for employees with Joining_Date but NULL Probation_End_Date
4. Set `Probation_Start_Date = Joining_Date` (if column exists)

## What Gets Updated

### Employment_End_Date

- **Source**: Offboarding table (`EmployeeOffboarding_v1`)
- **Target**: Employees table
- **Condition**: Only updates where `Employment_End_Date IS NULL` in Employees table
- **Type Handling**: Automatically casts STRING to DATE

### Probation_Period_Months

- **Value**: 3 (months)
- **Condition**: Only updates where `Probation_Period_Months IS NULL`
- **Note**: Requires column to exist (added in Step 1)

### Probation_End_Date

- **Calculation**: `DATE_ADD(Joining_Date, INTERVAL 3 MONTH)`
- **Condition**: Only updates where `Joining_Date IS NOT NULL` AND `Probation_End_Date IS NULL`
- **Also Sets**: `Probation_Start_Date = Joining_Date` (if column exists)

## After Migration

Once the migration is complete:

1. **New employees** will automatically get probation data when created via onboarding form
2. **Updating Joining_Date** will automatically recalculate Probation_End_Date
3. **Employment_End_Date** will display correctly for resigned/terminated employees

## Troubleshooting

### Error: "Probation_Period_Months column does not exist"

- **Solution**: Run Step 1 first to add the columns

### Error: "Value of type STRING cannot be assigned to Employment_End_Date"

- **Status**: Fixed in the migration script - it now casts STRING to DATE automatically

### Error: "Probation_Start_Date column does not exist"

- **Status**: The script will skip updating this column if it doesn't exist (non-critical)

## Code Changes

The following code changes have been made:

1. **Update API** (`employee-management-app/src/app/api/employees/[employeeId]/update/route.ts`):

   - Proper DATE type handling
   - Auto-calculates probation when Joining_Date is updated

2. **Onboarding** (`employee-management-app/src/lib/onboarding.ts`):

   - Auto-sets Probation_Period_Months = 3
   - Auto-calculates Probation_End_Date using SQL DATE_ADD

3. **Display** (`employee-management-app/src/lib/employees.ts`):
   - Prioritizes Employees.Employment_End_Date over Offboarding.Employment_End_Date

## Verification

After migration, verify the results:

```sql
-- Check probation data completeness
SELECT
  COUNT(*) as total,
  COUNT(Probation_Period_Months) as has_period,
  COUNT(Probation_End_Date) as has_end_date
FROM `test-imagine-web.Vyro_Business_Paradox.Employees`
WHERE Joining_Date IS NOT NULL;

-- Check Employment_End_Date for resigned employees
SELECT
  COUNT(*) as total_resigned,
  COUNT(Employment_End_Date) as has_end_date
FROM `test-imagine-web.Vyro_Business_Paradox.Employees`
WHERE Employment_Status IN ('Resigned/Terminated', 'Resigned', 'Terminated');
```
