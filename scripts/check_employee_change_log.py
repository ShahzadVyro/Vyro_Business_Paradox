#!/usr/bin/env python3
"""
Check if EmployeeChangeLog table exists in BigQuery
and compare it with Employee_Field_Updates table

Usage:
    python scripts/check_employee_change_log.py
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
TABLE_NAME = "EmployeeChangeLog"
COMPARISON_TABLE = "Employee_Field_Updates"

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
        # Try using default credentials
        return bigquery.Client(project=PROJECT_ID)

def check_table_exists(client, dataset_id, table_name):
    """Check if a table exists"""
    try:
        table_ref = client.dataset(dataset_id).table(table_name)
        table = client.get_table(table_ref)
        return True, table
    except Exception as e:
        return False, None

def get_table_info(client, dataset_id, table_name):
    """Get table information"""
    query = f"""
    SELECT 
      table_name,
      table_type,
      creation_time,
      last_modified_time,
      row_count,
      size_bytes,
      num_rows,
      description
    FROM `{PROJECT_ID}.{dataset_id}.INFORMATION_SCHEMA.TABLES`
    WHERE table_name = '{table_name}'
    """
    
    try:
        results = client.query(query).result()
        return list(results)
    except Exception as e:
        print(f"Error getting table info: {e}")
        return []

def get_table_schema(client, dataset_id, table_name):
    """Get table schema"""
    # Try with description first, fallback without it if not available
    query_with_desc = f"""
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default,
      description
    FROM `{PROJECT_ID}.{dataset_id}.INFORMATION_SCHEMA.COLUMNS`
    WHERE table_name = '{table_name}'
    ORDER BY ordinal_position
    """
    
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
        results = client.query(query_with_desc).result()
        return list(results)
    except Exception as e:
        # If description column doesn't exist, try without it
        try:
            results = client.query(query_without_desc).result()
            return list(results)
        except Exception as e2:
            print(f"Error getting schema: {e2}")
            return []

def get_table_stats(client, dataset_id, table_name):
    """Get table statistics"""
    query = f"""
    SELECT 
      COUNT(*) as total_rows,
      COUNT(DISTINCT Employee_ID) as unique_employees
    FROM `{PROJECT_ID}.{dataset_id}.{table_name}`
    """
    
    try:
        results = client.query(query).result()
        return list(results)
    except Exception as e:
        print(f"Error getting stats: {e}")
        return []

def get_sample_data(client, dataset_id, table_name, limit=5):
    """Get sample data"""
    query = f"""
    SELECT *
    FROM `{PROJECT_ID}.{dataset_id}.{table_name}`
    ORDER BY 
      COALESCE(Updated_Date, Created_At, CURRENT_TIMESTAMP()) DESC
    LIMIT {limit}
    """
    
    try:
        results = client.query(query).result()
        return list(results)
    except Exception as e:
        print(f"Error getting sample data: {e}")
        return []

def main():
    print("=" * 80)
    print("EmployeeChangeLog Table Checker")
    print("=" * 80)
    print(f"Project: {PROJECT_ID}")
    print(f"Dataset: {DATASET_ID}")
    print(f"Table: {TABLE_NAME}")
    print()
    
    # Initialize client
    try:
        client = get_bigquery_client()
        print("✓ Connected to BigQuery")
    except Exception as e:
        print(f"✗ Error connecting to BigQuery: {e}")
        return
    
    # Check if EmployeeChangeLog exists
    print("\n" + "=" * 80)
    print("1. Checking if EmployeeChangeLog table exists...")
    print("=" * 80)
    
    exists, table = check_table_exists(client, DATASET_ID, TABLE_NAME)
    
    if exists:
        print(f"✓ Table '{TABLE_NAME}' EXISTS")
        print(f"  - Table ID: {table.table_id}")
        print(f"  - Created: {table.created}")
        print(f"  - Modified: {table.modified}")
        print(f"  - Rows: {table.num_rows:,}" if table.num_rows else "  - Rows: Unknown")
        print(f"  - Size: {table.num_bytes:,} bytes" if table.num_bytes else "  - Size: Unknown")
        
        # Get detailed info
        print("\n" + "-" * 80)
        print("2. Table Information:")
        print("-" * 80)
        info = get_table_info(client, DATASET_ID, TABLE_NAME)
        if info:
            for row in info:
                print(f"  Table Name: {row.table_name}")
                print(f"  Type: {row.table_type}")
                if row.creation_time:
                    print(f"  Created: {row.creation_time}")
                if row.last_modified_time:
                    print(f"  Modified: {row.last_modified_time}")
                if row.num_rows is not None:
                    print(f"  Rows: {row.num_rows:,}")
                if row.size_bytes:
                    print(f"  Size: {row.size_bytes:,} bytes")
        
        # Get schema
        print("\n" + "-" * 80)
        print("3. Table Schema:")
        print("-" * 80)
        schema = get_table_schema(client, DATASET_ID, TABLE_NAME)
        if schema:
            print(f"{'Column Name':<30} {'Data Type':<20} {'Nullable':<10} {'Description'}")
            print("-" * 80)
            for row in schema:
                desc = row.description or ""
                print(f"{row.column_name:<30} {row.data_type:<20} {row.is_nullable:<10} {desc}")
        else:
            print("  Could not retrieve schema")
        
        # Get statistics
        print("\n" + "-" * 80)
        print("4. Table Statistics:")
        print("-" * 80)
        stats = get_table_stats(client, DATASET_ID, TABLE_NAME)
        if stats:
            for row in stats:
                print(f"  Total Rows: {row.total_rows:,}")
                print(f"  Unique Employees: {row.unique_employees:,}")
        
        # Get sample data
        print("\n" + "-" * 80)
        print("5. Sample Data (first 5 rows):")
        print("-" * 80)
        samples = get_sample_data(client, DATASET_ID, TABLE_NAME, limit=5)
        if samples:
            for i, row in enumerate(samples, 1):
                print(f"\n  Row {i}:")
                for key, value in row.items():
                    if value is not None:
                        print(f"    {key}: {value}")
        else:
            print("  No data found or error retrieving data")
        
        # Compare with Employee_Field_Updates
        print("\n" + "=" * 80)
        print("6. Comparison with Employee_Field_Updates:")
        print("=" * 80)
        
        comparison_exists, _ = check_table_exists(client, DATASET_ID, COMPARISON_TABLE)
        if comparison_exists:
            print(f"✓ {COMPARISON_TABLE} also exists")
            
            print(f"\n  {TABLE_NAME} columns:")
            schema1 = get_table_schema(client, DATASET_ID, TABLE_NAME)
            cols1 = [row.column_name for row in schema1] if schema1 else []
            for col in cols1:
                print(f"    - {col}")
            
            print(f"\n  {COMPARISON_TABLE} columns:")
            schema2 = get_table_schema(client, DATASET_ID, COMPARISON_TABLE)
            cols2 = [row.column_name for row in schema2] if schema2 else []
            for col in cols2:
                print(f"    - {col}")
            
            # Find common columns
            common = set(cols1) & set(cols2)
            only_in_change_log = set(cols1) - set(cols2)
            only_in_field_updates = set(cols2) - set(cols1)
            
            print(f"\n  Common columns: {len(common)}")
            if common:
                for col in sorted(common):
                    print(f"    - {col}")
            
            if only_in_change_log:
                print(f"\n  Only in {TABLE_NAME}: {len(only_in_change_log)}")
                for col in sorted(only_in_change_log):
                    print(f"    - {col}")
            
            if only_in_field_updates:
                print(f"\n  Only in {COMPARISON_TABLE}: {len(only_in_field_updates)}")
                for col in sorted(only_in_field_updates):
                    print(f"    - {col}")
        else:
            print(f"✗ {COMPARISON_TABLE} does not exist")
        
        # Recommendations
        print("\n" + "=" * 80)
        print("RECOMMENDATIONS:")
        print("=" * 80)
        print("1. If EmployeeChangeLog has important data:")
        print("   - Consider migrating data to Employee_Field_Updates")
        print("   - Or update code to use EmployeeChangeLog if preferred")
        print()
        print("2. If EmployeeChangeLog is empty or old:")
        print("   - Update Vercel BQ_AUDIT_TABLE to 'Employee_Field_Updates'")
        print("   - EmployeeChangeLog can be deprecated")
        print()
        print("3. For rejoin/lifecycle tracking:")
        print("   - Use Employee_Status_History table")
        print("   - Use Employees table with Rejoin_Sequence field")
        
    else:
        print(f"✗ Table '{TABLE_NAME}' DOES NOT EXIST")
        print()
        print("This means:")
        print("  - EmployeeChangeLog is not in your BigQuery dataset")
        print("  - The code uses Employee_Field_Updates instead")
        print("  - You should update Vercel BQ_AUDIT_TABLE to 'Employee_Field_Updates'")
        print()
        print("Checking Employee_Field_Updates instead...")
        
        comparison_exists, comparison_table = check_table_exists(client, DATASET_ID, COMPARISON_TABLE)
        if comparison_exists:
            print(f"✓ {COMPARISON_TABLE} EXISTS")
            print(f"  - Rows: {comparison_table.num_rows:,}" if comparison_table.num_rows else "  - Rows: Unknown")
            
            schema = get_table_schema(client, DATASET_ID, COMPARISON_TABLE)
            if schema:
                print(f"\n  Columns ({len(schema)}):")
                for row in schema:
                    print(f"    - {row.column_name} ({row.data_type})")
        else:
            print(f"✗ {COMPARISON_TABLE} also does not exist")
            print("  You may need to create it using:")
            print("  database/dimensions/create_employee_field_updates.sql")
    
    print("\n" + "=" * 80)
    print("Check complete!")
    print("=" * 80)

if __name__ == "__main__":
    main()
