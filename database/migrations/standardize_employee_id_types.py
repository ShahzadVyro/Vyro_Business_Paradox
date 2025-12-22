#!/usr/bin/env python3
"""
Migration Script: Standardize Employee_ID to INT64 in Pay_Template Tables

This script converts Employee_ID column from STRING to INT64 in all Pay_Template tables.
It validates that all Employee_IDs are numeric before conversion and handles NULL values.

Tables affected:
- Pay_Template_Increments
- Pay_Template_New_Hires
- Pay_Template_Leavers
- Pay_Template_Confirmations
"""

import os
import sys
from google.cloud import bigquery
from google.cloud.exceptions import NotFound
from google.oauth2 import service_account

# Add parent directory to path to import credentials
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "test-imagine-web")
DATASET_ID = "Vyro_Business_Paradox"

TABLES = [
    "Pay_Template_Increments",
    "Pay_Template_New_Hires",
    "Pay_Template_Leavers",
    "Pay_Template_Confirmations",
]


def get_bigquery_client():
    """Initialize BigQuery client."""
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "Credentials/test-imagine-web-18d4f9a43aef.json")
    
    # Set environment variable if not already set
    if not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials_path
    
    # Try to load credentials explicitly if file exists
    if os.path.exists(credentials_path):
        credentials = service_account.Credentials.from_service_account_file(
            credentials_path,
            scopes=["https://www.googleapis.com/auth/bigquery"]
        )
        return bigquery.Client(credentials=credentials, project=PROJECT_ID)
    
    # Fallback to default credentials (uses GOOGLE_APPLICATION_CREDENTIALS env var)
    return bigquery.Client(project=PROJECT_ID)


def check_table_exists(client, table_name):
    """Check if table exists."""
    table_ref = client.dataset(DATASET_ID).table(table_name)
    try:
        client.get_table(table_ref)
        return True
    except NotFound:
        return False


def validate_employee_ids(client, table_name):
    """Validate that all Employee_IDs are numeric."""
    query = f"""
    SELECT 
      COUNT(*) as total_records,
      COUNT(Employee_ID) as records_with_employee_id,
      COUNT(CASE WHEN Employee_ID IS NOT NULL AND REGEXP_CONTAINS(Employee_ID, r'^[0-9]+$') THEN 1 END) as numeric_employee_ids,
      COUNT(CASE WHEN Employee_ID IS NOT NULL AND NOT REGEXP_CONTAINS(Employee_ID, r'^[0-9]+$') THEN 1 END) as non_numeric_employee_ids
    FROM `{PROJECT_ID}.{DATASET_ID}.{table_name}`
    """
    
    result = client.query(query).result()
    row = next(result, None)
    
    if not row:
        return True, {"total_records": 0, "records_with_employee_id": 0, "numeric_employee_ids": 0, "non_numeric_employee_ids": 0}
    
    stats = {
        "total_records": row.total_records or 0,
        "records_with_employee_id": row.records_with_employee_id or 0,
        "numeric_employee_ids": row.numeric_employee_ids or 0,
        "non_numeric_employee_ids": row.non_numeric_employee_ids or 0,
    }
    
    is_valid = stats["non_numeric_employee_ids"] == 0
    return is_valid, stats


def get_non_numeric_employee_ids(client, table_name):
    """Get list of non-numeric Employee_IDs if any exist."""
    query = f"""
    SELECT DISTINCT Employee_ID
    FROM `{PROJECT_ID}.{DATASET_ID}.{table_name}`
    WHERE Employee_ID IS NOT NULL 
      AND NOT REGEXP_CONTAINS(Employee_ID, r'^[0-9]+$')
    """
    
    result = client.query(query).result()
    return [row.Employee_ID for row in result]


def create_backup_table(client, table_name):
    """Create a backup of the original table."""
    backup_table_name = f"{table_name}_backup_employee_id_string"
    backup_ref = client.dataset(DATASET_ID).table(backup_table_name)
    
    # Check if backup already exists
    try:
        client.get_table(backup_ref)
        print(f"  ⚠️  Backup table {backup_table_name} already exists. Skipping backup creation.")
        return backup_table_name
    except NotFound:
        pass
    
    # Create backup
    query = f"""
    CREATE TABLE `{PROJECT_ID}.{DATASET_ID}.{backup_table_name}`
    AS SELECT * FROM `{PROJECT_ID}.{DATASET_ID}.{table_name}`
    """
    
    client.query(query).result()
    print(f"  ✅ Created backup table: {backup_table_name}")
    return backup_table_name


def migrate_table(client, table_name, dry_run=True):
    """Migrate Employee_ID column from STRING to INT64."""
    print(f"\n📊 Processing table: {table_name}")
    
    # Check if table exists
    if not check_table_exists(client, table_name):
        print(f"  ⚠️  Table {table_name} does not exist. Skipping.")
        return False
    
    # Validate Employee_IDs
    print("  🔍 Validating Employee_ID values...")
    is_valid, stats = validate_employee_ids(client, table_name)
    
    print(f"    Total records: {stats['total_records']}")
    print(f"    Records with Employee_ID: {stats['records_with_employee_id']}")
    print(f"    Numeric Employee_IDs: {stats['numeric_employee_ids']}")
    print(f"    Non-numeric Employee_IDs: {stats['non_numeric_employee_ids']}")
    
    if not is_valid:
        non_numeric_ids = get_non_numeric_employee_ids(client, table_name)
        print(f"  ❌ ERROR: Found non-numeric Employee_IDs: {non_numeric_ids}")
        print(f"  Cannot proceed with migration. Please clean data first.")
        return False
    
    if stats['total_records'] == 0:
        print(f"  ℹ️  Table is empty. Updating schema...")
        if dry_run:
            print("  🔍 DRY RUN: Would update schema by recreating table with INT64 Employee_ID")
            return True
        
        # For empty tables, we can recreate with correct schema
        # Get current table schema
        table_ref = client.dataset(DATASET_ID).table(table_name)
        table = client.get_table(table_ref)
        
        # Create new schema with INT64 Employee_ID
        new_schema = []
        for field in table.schema:
            if field.name == "Employee_ID":
                new_field = bigquery.SchemaField(
                    name=field.name,
                    field_type="INTEGER",  # INT64
                    mode=field.mode,  # Keep NULLABLE
                    description=field.description,
                )
            else:
                new_field = field
            new_schema.append(new_field)
        
        # Delete and recreate table with new schema
        client.delete_table(table_ref)
        print(f"  ✅ Deleted old table")
        
        new_table = bigquery.Table(table_ref, schema=new_schema)
        # Preserve table options (clustering, labels, etc.)
        if hasattr(table, 'clustering_fields') and table.clustering_fields:
            new_table.clustering_fields = table.clustering_fields
        if hasattr(table, 'description'):
            new_table.description = table.description
        if hasattr(table, 'labels') and table.labels:
            new_table.labels = table.labels
        
        client.create_table(new_table)
        print(f"  ✅ Recreated table with INT64 Employee_ID schema")
        return True
    
    # Create backup
    print("  💾 Creating backup...")
    backup_table_name = create_backup_table(client, table_name)
    
    if dry_run:
        print("  🔍 DRY RUN: Would execute the following migration:")
        print(f"    ALTER TABLE `{PROJECT_ID}.{DATASET_ID}.{table_name}`")
        print(f"    ALTER COLUMN Employee_ID SET DATA TYPE INT64")
        return True
    
    # Execute migration
    print("  🔄 Executing migration...")
    
    # BigQuery doesn't support direct ALTER COLUMN TYPE, so we need to:
    # 1. Create new table with correct schema
    # 2. Copy data with CAST
    # 3. Replace old table
    
    # Step 1: Create new table with INT64 Employee_ID
    temp_table_name = f"{table_name}_temp_int64"
    
    # Get current table schema
    table_ref = client.dataset(DATASET_ID).table(table_name)
    table = client.get_table(table_ref)
    
    # Create new schema with INT64 Employee_ID
    new_schema = []
    for field in table.schema:
        if field.name == "Employee_ID":
            new_field = bigquery.SchemaField(
                name=field.name,
                field_type="INTEGER",  # INT64
                mode=field.mode,  # Keep NULLABLE
                description=field.description,
            )
        else:
            new_field = field
        new_schema.append(new_field)
    
    # Create temp table
    temp_table_ref = client.dataset(DATASET_ID).table(temp_table_name)
    temp_table = bigquery.Table(temp_table_ref, schema=new_schema)
    temp_table = client.create_table(temp_table)
    print(f"  ✅ Created temporary table: {temp_table_name}")
    
    # Step 2: Copy data with CAST
    copy_query = f"""
    INSERT INTO `{PROJECT_ID}.{DATASET_ID}.{temp_table_name}`
    SELECT 
      * EXCEPT(Employee_ID),
      CAST(Employee_ID AS INT64) as Employee_ID
    FROM `{PROJECT_ID}.{DATASET_ID}.{table_name}`
    """
    
    job = client.query(copy_query)
    job.result()  # Wait for completion
    print(f"  ✅ Copied data to temporary table")
    
    # Step 3: Delete old table and rename temp table
    client.delete_table(table_ref)
    print(f"  ✅ Deleted old table")
    
    # Rename temp table to original name
    temp_table_ref = client.dataset(DATASET_ID).table(temp_table_name)
    temp_table = client.get_table(temp_table_ref)
    temp_table.table_id = table_name
    client.create_table(temp_table)
    client.delete_table(temp_table_ref)
    print(f"  ✅ Renamed temporary table to {table_name}")
    
    print(f"  ✅ Migration completed successfully!")
    return True


def main():
    """Main migration function."""
    print("=" * 70)
    print("Employee_ID Type Standardization Migration")
    print("=" * 70)
    print(f"Project: {PROJECT_ID}")
    print(f"Dataset: {DATASET_ID}")
    print(f"Tables: {', '.join(TABLES)}")
    
    # Check for dry-run flag
    dry_run = "--dry-run" in sys.argv or "-d" in sys.argv
    
    if dry_run:
        print("\n🔍 DRY RUN MODE - No changes will be made")
    else:
        print("\n⚠️  LIVE MODE - Changes will be permanent")
        response = input("Continue? (yes/no): ")
        if response.lower() != "yes":
            print("Migration cancelled.")
            return
    
    client = get_bigquery_client()
    
    results = {}
    for table_name in TABLES:
        try:
            success = migrate_table(client, table_name, dry_run=dry_run)
            results[table_name] = success
        except Exception as e:
            print(f"  ❌ ERROR migrating {table_name}: {e}")
            results[table_name] = False
    
    # Summary
    print("\n" + "=" * 70)
    print("Migration Summary")
    print("=" * 70)
    for table_name, success in results.items():
        status = "✅ SUCCESS" if success else "❌ FAILED"
        print(f"{table_name}: {status}")
    
    if all(results.values()):
        print("\n✅ All migrations completed successfully!")
    else:
        print("\n⚠️  Some migrations failed. Please review errors above.")


if __name__ == "__main__":
    main()
