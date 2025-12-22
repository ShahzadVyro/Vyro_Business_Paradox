#!/usr/bin/env python3
"""
Check EmployeeIntake_v1 and Employee_Onboarding_Intake tables
Compare their structure, data, and usage in the codebase

Usage:
    python3 scripts/check_onboarding_tables.py
"""

import os
import sys
from pathlib import Path
from google.cloud import bigquery
from google.oauth2 import service_account

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Configuration
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "test-imagine-web")
DATASET_ID = os.getenv("BQ_DATASET", "Vyro_Business_Paradox")
TABLE_1 = "EmployeeIntake_v1"
TABLE_2 = "Employee_Onboarding_Intake"

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

def check_table_exists(client, dataset_id, table_name):
    """Check if a table exists"""
    try:
        table_ref = client.dataset(dataset_id).table(table_name)
        table = client.get_table(table_ref)
        return True, table
    except Exception as e:
        return False, None

def get_table_schema(client, dataset_id, table_name):
    """Get table schema"""
    query_without_desc = f"""
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default,
      CAST(NULL AS STRING) as description
    FROM `{PROJECT_ID}.{dataset_id}.INFORMATION_SCHEMA.COLUMNS`
    WHERE table_name = '{table_name}'
    ORDER BY ordinal_position
    """
    
    try:
        results = client.query(query_without_desc).result()
        return list(results)
    except Exception as e:
        print(f"Error getting schema: {e}")
        return []

def get_table_stats(client, dataset_id, table_name):
    """Get table statistics"""
    query = f"""
    SELECT 
      COUNT(*) as total_rows
    FROM `{PROJECT_ID}.{dataset_id}.{table_name}`
    """
    
    try:
        results = client.query(query).result()
        return list(results)
    except Exception as e:
        print(f"Error getting stats: {e}")
        return []

def get_sample_data(client, dataset_id, table_name, limit=3):
    """Get sample data"""
    query = f"""
    SELECT *
    FROM `{PROJECT_ID}.{dataset_id}.{table_name}`
    LIMIT {limit}
    """
    
    try:
        results = client.query(query).result()
        return list(results)
    except Exception as e:
        print(f"Error getting sample data: {e}")
        return []

def check_table_usage_in_code(table_name):
    """Check how table is used in codebase"""
    import subprocess
    try:
        result = subprocess.run(
            ['grep', '-r', table_name, 'employee-management-app/src'],
            capture_output=True,
            text=True,
            cwd=project_root
        )
        return result.stdout.split('\n') if result.stdout else []
    except:
        return []

def main():
    print("=" * 80)
    print("Onboarding Tables Checker")
    print("=" * 80)
    print(f"Project: {PROJECT_ID}")
    print(f"Dataset: {DATASET_ID}")
    print(f"Tables: {TABLE_1} and {TABLE_2}")
    print()
    
    # Initialize client
    try:
        client = get_bigquery_client()
        print("✓ Connected to BigQuery")
    except Exception as e:
        print(f"✗ Error connecting to BigQuery: {e}")
        return
    
    # Check both tables
    tables_to_check = [
        (TABLE_1, "BQ_INTAKE_TABLE"),
        (TABLE_2, "BQ_ONBOARDING_TABLE")
    ]
    
    for table_name, env_var in tables_to_check:
        print("\n" + "=" * 80)
        print(f"Checking: {table_name}")
        print(f"Environment Variable: {env_var}")
        print("=" * 80)
        
        exists, table = check_table_exists(client, DATASET_ID, table_name)
        
        if exists:
            print(f"✓ Table '{table_name}' EXISTS")
            print(f"  - Created: {table.created}")
            print(f"  - Modified: {table.modified}")
            print(f"  - Rows: {table.num_rows:,}" if table.num_rows else "  - Rows: Unknown")
            
            # Get schema
            print(f"\n  Schema ({table_name}):")
            schema = get_table_schema(client, DATASET_ID, table_name)
            if schema:
                print(f"    {'Column Name':<30} {'Data Type':<20} {'Nullable'}")
                print("    " + "-" * 70)
                for row in schema:
                    print(f"    {row.column_name:<30} {row.data_type:<20} {row.is_nullable}")
            else:
                print("    Could not retrieve schema")
            
            # Get statistics
            stats = get_table_stats(client, DATASET_ID, table_name)
            if stats:
                for row in stats:
                    print(f"\n  Statistics:")
                    print(f"    Total Rows: {row.total_rows:,}")
            
            # Get sample data
            samples = get_sample_data(client, DATASET_ID, table_name, limit=2)
            if samples:
                print(f"\n  Sample Data (first 2 rows):")
                for i, row in enumerate(samples, 1):
                    print(f"\n    Row {i}:")
                    for key, value in list(row.items())[:5]:  # Show first 5 columns
                        if value is not None:
                            val_str = str(value)
                            if len(val_str) > 50:
                                val_str = val_str[:47] + "..."
                            print(f"      {key}: {val_str}")
                    if len(row) > 5:
                        print(f"      ... ({len(row) - 5} more columns)")
            
            # Check usage in code
            print(f"\n  Usage in Codebase:")
            usage = check_table_usage_in_code(table_name)
            if usage:
                for line in usage[:5]:  # Show first 5 matches
                    if line.strip():
                        print(f"    {line.strip()}")
                if len(usage) > 5:
                    print(f"    ... ({len(usage) - 5} more matches)")
            else:
                print("    No references found in codebase")
                
        else:
            print(f"✗ Table '{table_name}' DOES NOT EXIST")
            print(f"\n  Usage in Codebase:")
            usage = check_table_usage_in_code(table_name)
            if usage:
                for line in usage[:5]:
                    if line.strip():
                        print(f"    {line.strip()}")
            else:
                print("    No references found in codebase")
    
    # Comparison
    print("\n" + "=" * 80)
    print("COMPARISON & RECOMMENDATIONS")
    print("=" * 80)
    
    exists1, _ = check_table_exists(client, DATASET_ID, TABLE_1)
    exists2, _ = check_table_exists(client, DATASET_ID, TABLE_2)
    
    if exists1 and exists2:
        print("Both tables exist. Checking if they serve different purposes...")
        schema1 = get_table_schema(client, DATASET_ID, TABLE_1)
        schema2 = get_table_schema(client, DATASET_ID, TABLE_2)
        
        cols1 = {row.column_name for row in schema1} if schema1 else set()
        cols2 = {row.column_name for row in schema2} if schema2 else set()
        
        if cols1 == cols2:
            print("⚠️  Tables have identical schemas - might be duplicates")
        else:
            print(f"✓ Tables have different schemas:")
            print(f"  {TABLE_1} has {len(cols1)} columns")
            print(f"  {TABLE_2} has {len(cols2)} columns")
            only_in_1 = cols1 - cols2
            only_in_2 = cols2 - cols1
            if only_in_1:
                print(f"\n  Only in {TABLE_1}: {', '.join(sorted(only_in_1))}")
            if only_in_2:
                print(f"\n  Only in {TABLE_2}: {', '.join(sorted(only_in_2))}")
    
    elif exists1 and not exists2:
        print(f"✓ {TABLE_1} exists, {TABLE_2} does not")
        print(f"\n  Recommendation:")
        print(f"    - Update Vercel BQ_ONBOARDING_TABLE to '{TABLE_1}'")
        print(f"    - Or create {TABLE_2} if you need a separate table")
    
    elif exists2 and not exists1:
        print(f"✓ {TABLE_2} exists, {TABLE_1} does not")
        print(f"\n  Recommendation:")
        print(f"    - Update Vercel BQ_INTAKE_TABLE to '{TABLE_2}'")
        print(f"    - Or create {TABLE_1} if you need a separate table")
    
    else:
        print("✗ Neither table exists")
        print(f"\n  Recommendation:")
        print(f"    - Create one of these tables if you need onboarding intake functionality")
        print(f"    - Or remove/disable the queries if not needed")
    
    print("\n" + "=" * 80)
    print("Check complete!")
    print("=" * 80)

if __name__ == "__main__":
    main()
