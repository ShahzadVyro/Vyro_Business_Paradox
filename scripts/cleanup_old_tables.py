#!/usr/bin/env python3
"""
Safely delete old BigQuery tables after confirmation.
Creates a log of deleted tables.
"""

import os
import sys
from datetime import datetime
from pathlib import Path
from google.cloud import bigquery
from dotenv import load_dotenv

# Try loading .env files from multiple locations
script_dir = Path(__file__).parent
root_dir = script_dir.parent
env_paths = [
    root_dir / "employee-management-app" / ".env.local",
    root_dir / ".env.local",
    root_dir / ".env",
    root_dir / "employee-management-app" / ".env",
]

for env_path in env_paths:
    if env_path.exists():
        load_dotenv(env_path)
        break
else:
    # If no .env file found, try loading from environment
    load_dotenv()

PROJECT_ID = os.getenv("GCP_PROJECT_ID")
DATASET_ID = os.getenv("BQ_DATASET", "Vyro_Business_Paradox")

if not PROJECT_ID:
    print("Error: GCP_PROJECT_ID environment variable is required")
    print("\nPlease set it in one of these ways:")
    print("1. Create a .env file in the root directory with: GCP_PROJECT_ID=test-imagine-web")
    print("2. Export it: export GCP_PROJECT_ID=test-imagine-web")
    print("3. Or set it in employee-management-app/.env.local")
    raise ValueError("GCP_PROJECT_ID environment variable is required")

# Tables to delete (identified by list_bigquery_tables.py)
# These tables have been replaced by the new unified schema
TABLES_TO_DELETE = [
    "EmployeeData",              # Old employee table (0 rows, replaced by Employees)
    "EmployeeData_v2",           # Intermediate table (462 rows, replaced by Employees)
    "Directory_Employees_Data",  # Source table (505 rows, data migrated to Employees)
    "Combined-USD_2025",         # Old salary table (504 rows, replaced by Employee_Salaries)
    "Combined-PKR_2025",        # Old salary table (1,044 rows, replaced by Employee_Salaries)
]

def delete_table(table_id, dry_run=True):
    """Delete a BigQuery table."""
    client = bigquery.Client(project=PROJECT_ID)
    table_ref = client.dataset(DATASET_ID).table(table_id)
    
    if dry_run:
        print(f"[DRY RUN] Would delete: {PROJECT_ID}.{DATASET_ID}.{table_id}")
        return True
    
    try:
        client.delete_table(table_ref, not_found_ok=True)
        print(f"✅ Deleted: {PROJECT_ID}.{DATASET_ID}.{table_id}")
        return True
    except Exception as e:
        print(f"❌ Error deleting {table_id}: {e}")
        return False

def main():
    """Main cleanup function."""
    if not TABLES_TO_DELETE:
        print("⚠️  No tables specified for deletion.")
        print("Please update TABLES_TO_DELETE list in this script after reviewing list_bigquery_tables.py output.")
        return
    
    print(f"\n{'='*80}")
    print(f"BigQuery Table Cleanup")
    print(f"{'='*80}\n")
    print(f"Project: {PROJECT_ID}")
    print(f"Dataset: {DATASET_ID}")
    print(f"\nTables to delete: {len(TABLES_TO_DELETE)}")
    for table_id in TABLES_TO_DELETE:
        print(f"  - {table_id}")
    
    # Dry run first
    print(f"\n{'='*80}")
    print("DRY RUN (no tables will be deleted):")
    print(f"{'='*80}\n")
    
    for table_id in TABLES_TO_DELETE:
        delete_table(table_id, dry_run=True)
    
    # Ask for confirmation
    print(f"\n{'='*80}")
    response = input("Do you want to proceed with deletion? (yes/no): ").strip().lower()
    
    if response != "yes":
        print("Cancelled. No tables were deleted.")
        return
    
    # Actual deletion
    print(f"\n{'='*80}")
    print("DELETING TABLES:")
    print(f"{'='*80}\n")
    
    deleted = []
    failed = []
    
    for table_id in TABLES_TO_DELETE:
        if delete_table(table_id, dry_run=False):
            deleted.append(table_id)
        else:
            failed.append(table_id)
    
    # Log results
    log_file = f"table_cleanup_log_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    with open(log_file, "w") as f:
        f.write(f"BigQuery Table Cleanup Log\n")
        f.write(f"Date: {datetime.now().isoformat()}\n")
        f.write(f"Project: {PROJECT_ID}\n")
        f.write(f"Dataset: {DATASET_ID}\n\n")
        f.write(f"Deleted ({len(deleted)}):\n")
        for table_id in deleted:
            f.write(f"  - {table_id}\n")
        f.write(f"\nFailed ({len(failed)}):\n")
        for table_id in failed:
            f.write(f"  - {table_id}\n")
    
    print(f"\n{'='*80}")
    print(f"Summary:")
    print(f"  ✅ Deleted: {len(deleted)}")
    print(f"  ❌ Failed: {len(failed)}")
    print(f"  📝 Log saved to: {log_file}")
    print(f"{'='*80}\n")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nCancelled by user.")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

