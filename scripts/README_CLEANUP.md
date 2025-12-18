# BigQuery Table Cleanup Scripts

## Overview

These scripts help identify and safely delete old/unnecessary BigQuery tables after migrating to the new unified schema.

## Scripts

### 1. `list_bigquery_tables.py`

Lists all tables in the BigQuery dataset with metadata (row count, size, creation date) and categorizes them:
- ✅ **Current tables** - Tables that should be kept (new unified schema)
- ❌ **Old tables** - Tables that can be deleted (replaced by new schema)
- ❓ **Other tables** - Tables that need manual review

**Usage:**
```bash
python3 scripts/list_bigquery_tables.py
```

**Output:**
- Lists all tables with metadata
- Categorizes tables into current/old/other
- Shows row counts and sizes

### 2. `cleanup_old_tables.py`

Safely deletes old BigQuery tables after confirmation.

**Before running:**
1. Run `list_bigquery_tables.py` first to identify old tables
2. Update the `TABLES_TO_DELETE` list in `cleanup_old_tables.py` with the table names you want to delete

**Usage:**
```bash
python3 scripts/cleanup_old_tables.py
```

**Features:**
- Dry run mode (shows what would be deleted without actually deleting)
- Requires explicit confirmation before deletion
- Creates a log file of deleted tables
- Handles errors gracefully

**Example:**
```python
# In cleanup_old_tables.py, update this list:
TABLES_TO_DELETE = [
    "EmployeeData",
    "EmployeeData_v2",
    "Directory_Employees_Data",
    "Combined-USD_2025",
    "Combined-PKR_2025",
]
```

## Old Tables to Consider Deleting

Based on the migration to the unified schema, these tables are likely candidates for deletion:

- `EmployeeData` - Old employee table (replaced by `Employees`)
- `EmployeeData_v2` - Intermediate table (replaced by `Employees`)
- `Directory_Employees_Data` - Source table (data migrated to `Employees`)
- `Combined-USD_2025` - Old salary table (replaced by `Employee_Salaries`)
- `Combined-PKR_2025` - Old salary table (replaced by `Employee_Salaries`)

## Current Tables (Keep These)

These tables are part of the new unified schema and should NOT be deleted:

- `Employees` - Main employee dimension table
- `Employee_Salaries` - Salary fact table
- `Employee_EOBI` - EOBI fact table
- `Employee_OPD_Benefits` - OPD benefits table
- `Employee_Tax_Calculations` - Tax calculations table
- `Employee_Field_Updates` - Audit trail
- `Employee_Lifecycle_Events` - Lifecycle tracking
- `Employee_Status_History` - Status history
- `EmployeeOffboarding_v1` - Offboarding records
- `EmployeeDirectoryHistory_v1` - Directory history
- `Employee_Salary_History` - Salary history
- `Devices` - Device catalog
- `Access_Platforms` - Platform catalog
- `Employee_Device_Assignments` - Device assignments
- `Employee_Access_Grants` - Access grants

## Safety Notes

⚠️ **IMPORTANT:**
- Always run `list_bigquery_tables.py` first to review tables
- Verify data has been migrated to new tables before deleting old ones
- The cleanup script creates a log file for audit purposes
- Consider creating backups before deletion (optional, script doesn't do this automatically)

## Prerequisites

- Python 3.7+
- `google-cloud-bigquery` library installed
- `python-dotenv` library installed
- Valid Google Cloud credentials configured
- Environment variables set (GCP_PROJECT_ID, BQ_DATASET)

## Installation

```bash
pip install google-cloud-bigquery python-dotenv
```

