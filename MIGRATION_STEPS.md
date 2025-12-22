# Migration Steps - Quick Start Guide

## Prerequisites

1. ✅ BigQuery tables already created (you've done this)
2. ✅ CSV reference files in place:
   - `Active Employees.csv` (in project root)
   - `Resigned:Terminated Employees.csv` (in project root)
3. ✅ Google Cloud credentials configured

## Step-by-Step Migration

### Step 1: Verify CSV Files Are Present

```bash
cd "/Users/shahzadvyro/Desktop/Vyro_Business_Paradox"
ls -la "Active Employees.csv" "Resigned:Terminated Employees.csv"
```

### Step 2: (Optional) Backup Existing Employees Table

If the Employees table already exists and you want to keep the existing data as backup:

```bash
# Check if table exists first
bq query --use_legacy_sql=false "SELECT COUNT(*) FROM \`test-imagine-web.Vyro_Business_Paradox.Employees\` LIMIT 1" > /dev/null 2>&1

# If table exists, create backup
if [ $? -eq 0 ]; then
    bq cp test-imagine-web:Vyro_Business_Paradox.Employees test-imagine-web:Vyro_Business_Paradox.Employees_backup_$(date +%Y%m%d)
    echo "✅ Backup created"
else
    echo "ℹ️  Employees table doesn't exist yet, skipping backup"
fi
```

### Step 3: Drop and Recreate Employees Table (Fresh Start)

```bash
# Drop existing table (if it exists)
bq rm -f -t test-imagine-web:Vyro_Business_Paradox.Employees

# Recreate table
bq query --use_legacy_sql=false < database/dimensions/create_employees_dimension.sql
```

### Step 4: Run Employee Data Migration

This will:

- Load all employee data from BigQuery source tables
- Use CSV files to set correct Employment_Status
- Save everything to Employees table

```bash
python3 database/migrations/migrate_employee_data.py
```

**Expected Output:**

- Should show: "Loaded reference files: 158 Active, 341 Resigned/Terminated"
- Should show: "Consolidated data: ~499 rows"
- Should complete successfully

### Step 6: Verify Migration Results

```bash
# Check total employees
bq query --use_legacy_sql=false "SELECT COUNT(*) as total FROM \`test-imagine-web.Vyro_Business_Paradox.Employees\`"

# Check Employment_Status distribution
bq query --use_legacy_sql=false "SELECT Employment_Status, COUNT(*) as count FROM \`test-imagine-web.Vyro_Business_Paradox.Employees\` GROUP BY Employment_Status ORDER BY count DESC"

# Should show:
# Active: 158
# Resigned/Terminated: 341
```

### Step 7: (Optional) Run Salary Data Migration

If you haven't already migrated salary data:

```bash
python3 database/migrations/migrate_salary_data.py
```

### Step 8: Run Data Validation

```bash
bq query --use_legacy_sql=false < database/migrations/data_validation_queries.sql
```

## Troubleshooting

### If CSV files not found:

- Make sure CSV files are in the project root directory
- Check file names match exactly: `Active Employees.csv` and `Resigned:Terminated Employees.csv`

### If migration fails:

- Check Google Cloud credentials are set: `echo $GOOGLE_APPLICATION_CREDENTIALS`
- Verify BigQuery source tables exist
- Check Python dependencies: `pip install google-cloud-bigquery pandas-gbq pyarrow`

## Key Files

- **Migration Script**: `database/migrations/migrate_employee_data.py`
- **Add Missing Employees Script**: `database/migrations/add_missing_employees_from_csv.py`
- **CSV Reference Files**:
  - `Active Employees.csv`
  - `Resigned:Terminated Employees.csv`
- **Table Schema**: `database/dimensions/create_employees_dimension.sql`

## About Source Tables

You have two source tables:

- **Directory_Employees_Data**: Primary source with INT64 Employee_IDs (475 rows)
- **EmployeeData_v2**: Secondary source with STRING Employee_IDs (462 rows)

**After migration:**

- ✅ Unified `Employees` table becomes single source of truth
- ✅ Both source tables can be archived/deprecated
- ✅ All future updates go to `Employees` table only

## After Migration

Once migration completes successfully:

- ✅ BigQuery Employees table is your single source of truth
- ✅ All employee data is in BigQuery
- ✅ Employment_Status correctly categorized (158 Active, 341 Resigned/Terminated)
- ✅ CSV files are no longer needed (they were only used during migration)
