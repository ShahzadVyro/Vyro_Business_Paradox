#!/usr/bin/env python3
"""
Migrate Employment End Date and Probation Period Data
======================================================
Backfills missing data:
1. Employment_End_Date from Offboarding table to Employees table (where NULL)
2. Probation_Period_Months = 3 for all employees where NULL
3. Probation_End_Date = DATE_ADD(Joining_Date, INTERVAL 3 MONTH) for employees with Joining_Date but NULL Probation_End_Date

Prerequisites:
    - Google Cloud credentials configured
    - google-cloud-bigquery library installed: pip install google-cloud-bigquery

Usage:
    python3 scripts/migrate_employment_and_probation_dates.py [--dry-run]

Author: AI Assistant
Date: December 2025
"""

import sys
import os
import argparse
from pathlib import Path
from google.cloud import bigquery
from google.oauth2 import service_account

# Add parent directory to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Configuration
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "test-imagine-web")
DATASET_ID = os.getenv("BQ_DATASET", "Vyro_Business_Paradox")
EMPLOYEES_TABLE = os.getenv("BQ_TABLE", "Employees")
OFFBOARDING_TABLE = os.getenv("BQ_OFFBOARDING_TABLE", "EmployeeOffboarding_v1")

def get_bigquery_client():
    """Initialize BigQuery client"""
    credentials_path = project_root / "Credentials" / "serviceAccountKey.json"
    
    if credentials_path.exists():
        credentials = service_account.Credentials.from_service_account_file(
            str(credentials_path),
            scopes=["https://www.googleapis.com/auth/bigquery"]
        )
        return bigquery.Client(credentials=credentials, project=PROJECT_ID)
    else:
        return bigquery.Client(project=PROJECT_ID)

def log(message):
    """Print timestamped log message"""
    from datetime import datetime
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def get_statistics(client):
    """Get statistics about missing data"""
    employees_ref = f"`{PROJECT_ID}.{DATASET_ID}.{EMPLOYEES_TABLE}`"
    offboarding_ref = f"`{PROJECT_ID}.{DATASET_ID}.{OFFBOARDING_TABLE}`"
    
    # Check if Probation_Period_Months column exists
    has_probation_period = check_column_exists(client, "Probation_Period_Months")
    
    # Build query conditionally based on column existence
    if has_probation_period:
        probation_period_select = f"(SELECT COUNT(*) FROM {employees_ref} WHERE Probation_Period_Months IS NULL) as missing_probation_period,"
        probation_missing_select = f"(SELECT COUNT(*) FROM {employees_ref} WHERE Joining_Date IS NOT NULL AND (Probation_Period_Months IS NULL OR Probation_End_Date IS NULL)) as has_joining_date_no_probation,"
    else:
        probation_period_select = "NULL as missing_probation_period,"
        probation_missing_select = f"(SELECT COUNT(*) FROM {employees_ref} WHERE Joining_Date IS NOT NULL AND Probation_End_Date IS NULL) as has_joining_date_no_probation,"
    
    stats_query = f"""
    SELECT 
        (SELECT COUNT(*) FROM {employees_ref} WHERE Employment_Status IN ('Resigned/Terminated', 'Resigned', 'Terminated') AND Employment_End_Date IS NULL) as missing_employment_end_date,
        {probation_period_select}
        (SELECT COUNT(*) FROM {employees_ref} WHERE Joining_Date IS NOT NULL AND Probation_End_Date IS NULL) as missing_probation_end_date,
        {probation_missing_select}
        (SELECT COUNT(*) FROM {employees_ref} e 
         LEFT JOIN {offboarding_ref} o ON CAST(e.Employee_ID AS STRING) = o.Employee_ID
         WHERE e.Employment_Status IN ('Resigned/Terminated', 'Resigned', 'Terminated')
           AND e.Employment_End_Date IS NULL
           AND o.Employment_End_Date IS NOT NULL) as can_backfill_from_offboarding
    """
    
    try:
        results = client.query(stats_query).result()
        return list(results)[0]
    except Exception as e:
        log(f"Error getting statistics: {e}")
        return None

def migrate_employment_end_date(client, dry_run=False):
    """Backfill Employment_End_Date from Offboarding table"""
    employees_ref = f"`{PROJECT_ID}.{DATASET_ID}.{EMPLOYEES_TABLE}`"
    offboarding_ref = f"`{PROJECT_ID}.{DATASET_ID}.{OFFBOARDING_TABLE}`"
    
    # Cast Offboarding.Employment_End_Date to DATE since it might be STRING
    update_query = f"""
    UPDATE {employees_ref} e
    SET Employment_End_Date = CAST(o.Employment_End_Date AS DATE),
        Updated_At = CURRENT_DATETIME()
    FROM {offboarding_ref} o
    WHERE CAST(e.Employee_ID AS STRING) = o.Employee_ID
      AND e.Employment_Status IN ('Resigned/Terminated', 'Resigned', 'Terminated')
      AND e.Employment_End_Date IS NULL
      AND o.Employment_End_Date IS NOT NULL
    """
    
    if dry_run:
        count_query = f"""
        SELECT COUNT(*) as count
        FROM {employees_ref} e
        INNER JOIN {offboarding_ref} o ON CAST(e.Employee_ID AS STRING) = o.Employee_ID
        WHERE e.Employment_Status IN ('Resigned/Terminated', 'Resigned', 'Terminated')
          AND e.Employment_End_Date IS NULL
          AND o.Employment_End_Date IS NOT NULL
        """
        results = client.query(count_query).result()
        count = list(results)[0].count
        log(f"[DRY RUN] Would update {count} employees with Employment_End_Date from Offboarding table")
        return count
    else:
        try:
            job = client.query(update_query)
            job.result()  # Wait for completion
            log(f"✓ Updated Employment_End_Date for employees from Offboarding table")
            return job.num_dml_affected_rows if hasattr(job, 'num_dml_affected_rows') else None
        except Exception as e:
            log(f"✗ Error updating Employment_End_Date: {e}")
            return None

def check_column_exists(client, column_name):
    """Check if a column exists in Employees table"""
    try:
        query = f"""
        SELECT column_name
        FROM `{PROJECT_ID}.{DATASET_ID}.INFORMATION_SCHEMA.COLUMNS`
        WHERE table_name = @table_name
          AND column_name = @column_name
        """
        results = client.query(query, job_config=bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("table_name", "STRING", EMPLOYEES_TABLE),
                bigquery.ScalarQueryParameter("column_name", "STRING", column_name),
            ]
        )).result()
        return len(list(results)) > 0
    except Exception as e:
        log(f"Error checking column {column_name}: {e}")
        return False

def migrate_probation_period_months(client, dry_run=False):
    """Set Probation_Period_Months = 3 for all employees where NULL"""
    # Check if column exists first
    if not check_column_exists(client, "Probation_Period_Months"):
        log("⚠ Probation_Period_Months column does not exist. Skipping migration.")
        log("  Please run: database/add_probation_columns.sql first")
        return None
    
    employees_ref = f"`{PROJECT_ID}.{DATASET_ID}.{EMPLOYEES_TABLE}`"
    
    update_query = f"""
    UPDATE {employees_ref}
    SET Probation_Period_Months = 3,
        Updated_At = CURRENT_DATETIME()
    WHERE Probation_Period_Months IS NULL
    """
    
    if dry_run:
        count_query = f"""
        SELECT COUNT(*) as count
        FROM {employees_ref}
        WHERE Probation_Period_Months IS NULL
        """
        results = client.query(count_query).result()
        count = list(results)[0].count
        log(f"[DRY RUN] Would set Probation_Period_Months = 3 for {count} employees")
        return count
    else:
        try:
            job = client.query(update_query)
            job.result()  # Wait for completion
            log(f"✓ Set Probation_Period_Months = 3 for employees")
            return job.num_dml_affected_rows if hasattr(job, 'num_dml_affected_rows') else None
        except Exception as e:
            log(f"✗ Error updating Probation_Period_Months: {e}")
            return None

def migrate_probation_end_date(client, dry_run=False):
    """Calculate Probation_End_Date = DATE_ADD(Joining_Date, INTERVAL 3 MONTH) for employees with Joining_Date but NULL Probation_End_Date"""
    employees_ref = f"`{PROJECT_ID}.{DATASET_ID}.{EMPLOYEES_TABLE}`"
    
    # Check if Probation_Start_Date column exists
    has_probation_start = check_column_exists(client, "Probation_Start_Date")
    
    # Build SET clause conditionally
    if has_probation_start:
        set_clause = "Probation_End_Date = DATE_ADD(Joining_Date, INTERVAL 3 MONTH),\n        Probation_Start_Date = Joining_Date,"
    else:
        set_clause = "Probation_End_Date = DATE_ADD(Joining_Date, INTERVAL 3 MONTH),"
        log("⚠ Probation_Start_Date column does not exist. Skipping Probation_Start_Date update.")
    
    update_query = f"""
    UPDATE {employees_ref}
    SET {set_clause}
        Updated_At = CURRENT_DATETIME()
    WHERE Joining_Date IS NOT NULL
      AND Probation_End_Date IS NULL
    """
    
    if dry_run:
        count_query = f"""
        SELECT COUNT(*) as count
        FROM {employees_ref}
        WHERE Joining_Date IS NOT NULL
          AND Probation_End_Date IS NULL
        """
        results = client.query(count_query).result()
        count = list(results)[0].count
        log(f"[DRY RUN] Would calculate Probation_End_Date for {count} employees")
        return count
    else:
        try:
            job = client.query(update_query)
            job.result()  # Wait for completion
            log(f"✓ Calculated Probation_End_Date for employees")
            return job.num_dml_affected_rows if hasattr(job, 'num_dml_affected_rows') else None
        except Exception as e:
            log(f"✗ Error updating Probation_End_Date: {e}")
            return None

def main():
    """Main function"""
    parser = argparse.ArgumentParser(description='Migrate Employment End Date and Probation Period data')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be updated without making changes')
    args = parser.parse_args()
    
    log("="*80)
    log("Employment End Date and Probation Period Migration")
    log("="*80)
    log(f"Project: {PROJECT_ID}")
    log(f"Dataset: {DATASET_ID}")
    log(f"Employees Table: {EMPLOYEES_TABLE}")
    log(f"Offboarding Table: {OFFBOARDING_TABLE}")
    if args.dry_run:
        log("MODE: DRY RUN (no changes will be made)")
    log("")
    
    client = get_bigquery_client()
    
    # Check if required columns exist
    log("Checking required columns...")
    has_probation_period = check_column_exists(client, "Probation_Period_Months")
    has_probation_start = check_column_exists(client, "Probation_Start_Date")
    
    if not has_probation_period or not has_probation_start:
        log("")
        log("⚠️  WARNING: Missing required columns!")
        if not has_probation_period:
            log("   - Probation_Period_Months column is missing")
        if not has_probation_start:
            log("   - Probation_Start_Date column is missing")
        log("")
        log("Please run the SQL migration first:")
        log("   python3 scripts/run_probation_columns_migration.py")
        log("")
        log("Or manually execute: database/add_probation_columns.sql")
        log("")
        if not args.dry_run:
            log("Migration aborted. Please add the columns first.")
            return
        else:
            log("Continuing with dry-run (some operations will be skipped)...")
    log("")
    
    # Get statistics
    log("1. Gathering Statistics...")
    stats = get_statistics(client)
    if stats:
        log(f"   Missing Employment_End_Date (resigned/terminated): {stats.missing_employment_end_date}")
        log(f"   Missing Probation_Period_Months: {stats.missing_probation_period}")
        log(f"   Missing Probation_End_Date (with Joining_Date): {stats.missing_probation_end_date}")
        log(f"   Can backfill from Offboarding table: {stats.can_backfill_from_offboarding}")
    log("")
    
    # Migrate Employment_End_Date
    log("2. Migrating Employment_End_Date from Offboarding table...")
    migrate_employment_end_date(client, dry_run=args.dry_run)
    log("")
    
    # Migrate Probation_Period_Months
    log("3. Setting Probation_Period_Months = 3...")
    migrate_probation_period_months(client, dry_run=args.dry_run)
    log("")
    
    # Migrate Probation_End_Date
    log("4. Calculating Probation_End_Date = Joining_Date + 3 months...")
    migrate_probation_end_date(client, dry_run=args.dry_run)
    log("")
    
    if not args.dry_run:
        # Get final statistics
        log("5. Final Statistics...")
        final_stats = get_statistics(client)
        if final_stats:
            log(f"   Remaining missing Employment_End_Date: {final_stats.missing_employment_end_date}")
            log(f"   Remaining missing Probation_Period_Months: {final_stats.missing_probation_period}")
            log(f"   Remaining missing Probation_End_Date: {final_stats.missing_probation_end_date}")
    
    log("="*80)
    log("Migration Complete!")
    log("="*80)

if __name__ == "__main__":
    main()
