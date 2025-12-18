#!/usr/bin/env python3
"""
List all BigQuery tables in the dataset with metadata.
Helps identify old/unnecessary tables for cleanup.
"""

import os
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

# Old table patterns to identify
OLD_TABLE_PATTERNS = [
    "EmployeeData",
    "EmployeeData_v2",
    "Directory_Employees_Data",
    "Combined-USD_2025",
    "Combined-PKR_2025",
]

# Current tables (should be kept)
CURRENT_TABLES = [
    "Employees",
    "Employee_Salaries",
    "Employee_EOBI",
    "Employee_OPD_Benefits",
    "Employee_Tax_Calculations",
    "Employee_Field_Updates",
    "Employee_Lifecycle_Events",
    "Employee_Status_History",
    "EmployeeOffboarding_v1",
    "EmployeeDirectoryHistory_v1",
    "Employee_Salary_History",
    "Devices",
    "Access_Platforms",
    "Employee_Device_Assignments",
    "Employee_Access_Grants",
]

def list_all_tables():
    """List all tables in the dataset with metadata."""
    client = bigquery.Client(project=PROJECT_ID)
    dataset_ref = client.dataset(DATASET_ID)
    
    print(f"\n{'='*80}")
    print(f"BigQuery Tables in: {PROJECT_ID}.{DATASET_ID}")
    print(f"{'='*80}\n")
    
    tables = list(client.list_tables(dataset_ref))
    
    if not tables:
        print("No tables found in dataset.")
        return
    
    # Categorize tables
    old_tables = []
    current_tables = []
    other_tables = []
    
    for table in tables:
        table_id = table.table_id
        table_ref = dataset_ref.table(table_id)
        
        # Get table info
        try:
            table_obj = client.get_table(table_ref)
            num_rows = table_obj.num_rows
            created = table_obj.created
            modified = table_obj.modified
            
            # Check if it's an old table
            is_old = any(pattern in table_id for pattern in OLD_TABLE_PATTERNS)
            is_current = table_id in CURRENT_TABLES
            
            table_info = {
                "id": table_id,
                "rows": num_rows,
                "created": created,
                "modified": modified,
                "size_mb": table_obj.num_bytes / (1024 * 1024) if table_obj.num_bytes else 0,
            }
            
            if is_old:
                old_tables.append(table_info)
            elif is_current:
                current_tables.append(table_info)
            else:
                other_tables.append(table_info)
                
        except Exception as e:
            print(f"Error getting info for {table_id}: {e}")
    
    # Print current tables
    print("✅ CURRENT TABLES (Keep these):")
    print("-" * 80)
    if current_tables:
        for t in sorted(current_tables, key=lambda x: x["id"]):
            print(f"  {t['id']:40} | {t['rows']:>10,} rows | {t['size_mb']:>8.2f} MB | Created: {t['created']}")
    else:
        print("  (None found)")
    
    # Print old tables
    print(f"\n❌ OLD TABLES (Consider deleting):")
    print("-" * 80)
    if old_tables:
        for t in sorted(old_tables, key=lambda x: x["id"]):
            print(f"  {t['id']:40} | {t['rows']:>10,} rows | {t['size_mb']:>8.2f} MB | Created: {t['created']}")
    else:
        print("  (None found)")
    
    # Print other tables
    print(f"\n❓ OTHER TABLES (Review manually):")
    print("-" * 80)
    if other_tables:
        for t in sorted(other_tables, key=lambda x: x["id"]):
            print(f"  {t['id']:40} | {t['rows']:>10,} rows | {t['size_mb']:>8.2f} MB | Created: {t['created']}")
    else:
        print("  (None found)")
    
    print(f"\n{'='*80}")
    print(f"Summary: {len(current_tables)} current, {len(old_tables)} old, {len(other_tables)} other")
    print(f"{'='*80}\n")
    
    return {
        "current": current_tables,
        "old": old_tables,
        "other": other_tables,
    }

if __name__ == "__main__":
    try:
        list_all_tables()
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

