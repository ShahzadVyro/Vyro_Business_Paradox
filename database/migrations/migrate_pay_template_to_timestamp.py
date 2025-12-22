#!/usr/bin/env python3
"""
Migration Script: Convert DATETIME to TIMESTAMP in Pay_Template Tables

This script converts Created_At, Updated_At, and Approved_At columns from DATETIME to TIMESTAMP
in all Pay_Template tables. TIMESTAMP is the correct type for audit fields as it includes timezone.

Tables affected:
- Pay_Template_Increments (Created_At, Updated_At)
- Pay_Template_Confirmations (Created_At, Updated_At, Approved_At)
- Pay_Template_New_Hires (Created_At, Updated_At) - if exists
- Pay_Template_Leavers (Created_At, Updated_At) - if exists
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

# Define tables and their timestamp columns
TABLES_CONFIG = {
    "Pay_Template_Increments": ["Created_At", "Updated_At"],
    "Pay_Template_Confirmations": ["Created_At", "Updated_At", "Approved_At"],
    "Pay_Template_New_Hires": ["Created_At", "Updated_At"],
    "Pay_Template_Leavers": ["Created_At", "Updated_At"],
    "Employees": ["Created_At", "Updated_At"],  # Employees table is also updated by pay template operations
}


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


def check_column_type(client, table_name, column_name):
    """Check the data type of a specific column."""
    query = f"""
    SELECT data_type
    FROM `{PROJECT_ID}.{DATASET_ID}.INFORMATION_SCHEMA.COLUMNS`
    WHERE table_name = '{table_name}'
      AND column_name = '{column_name}'
    """
    
    result = client.query(query).result()
    row = next(result, None)
    
    if not row:
        return None
    
    return row.data_type


def get_table_schema(client, table_name):
    """Get the full schema of a table."""
    table_ref = client.dataset(DATASET_ID).table(table_name)
    table = client.get_table(table_ref)
    return table.schema, table


def create_backup_table(client, table_name):
    """Create a backup of the original table."""
    backup_table_name = f"{table_name}_backup_datetime"
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


def migrate_table(client, table_name, timestamp_columns, dry_run=True):
    """Migrate DATETIME columns to TIMESTAMP."""
    print(f"\n📊 Processing table: {table_name}")
    
    # Check if table exists
    if not check_table_exists(client, table_name):
        print(f"  ⚠️  Table {table_name} does not exist. Skipping.")
        return False
    
    # Check current column types
    print("  🔍 Checking column types...")
    needs_migration = False
    column_types = {}
    
    for column_name in timestamp_columns:
        col_type = check_column_type(client, table_name, column_name)
        column_types[column_name] = col_type
        
        if col_type is None:
            print(f"    ⚠️  Column {column_name} not found. Skipping.")
            continue
        
        if col_type == "DATETIME":
            needs_migration = True
            print(f"    ❌ {column_name}: {col_type} (needs migration)")
        elif col_type == "TIMESTAMP":
            print(f"    ✅ {column_name}: {col_type} (already correct)")
        else:
            print(f"    ⚠️  {column_name}: {col_type} (unexpected type)")
    
    if not needs_migration:
        print(f"  ✅ No migration needed - all columns are already TIMESTAMP")
        return True
    
    # Get table info
    table_ref = client.dataset(DATASET_ID).table(table_name)
    table = client.get_table(table_ref)
    
    # Check if table has data
    count_query = f"SELECT COUNT(*) as cnt FROM `{PROJECT_ID}.{DATASET_ID}.{table_name}`"
    count_result = client.query(count_query).result()
    row_count = next(count_result).cnt
    
    if row_count == 0:
        print(f"  ℹ️  Table is empty. Updating schema by recreating table...")
        if dry_run:
            print("  🔍 DRY RUN: Would recreate table with TIMESTAMP columns")
            return True
        
        # For empty tables, recreate with correct schema
        new_schema = []
        for field in table.schema:
            if field.name in timestamp_columns and column_types.get(field.name) == "DATETIME":
                # Change DATETIME to TIMESTAMP
                new_field = bigquery.SchemaField(
                    name=field.name,
                    field_type="TIMESTAMP",
                    mode=field.mode,
                    description=field.description,
                )
            else:
                new_field = field
            new_schema.append(new_field)
        
        # Delete and recreate table
        client.delete_table(table_ref)
        print(f"  ✅ Deleted old table")
        
        new_table = bigquery.Table(table_ref, schema=new_schema)
        # Preserve table options
        if hasattr(table, 'clustering_fields') and table.clustering_fields:
            new_table.clustering_fields = table.clustering_fields
        if hasattr(table, 'description'):
            new_table.description = table.description
        if hasattr(table, 'labels') and table.labels:
            new_table.labels = table.labels
        
        client.create_table(new_table)
        print(f"  ✅ Recreated table with TIMESTAMP columns")
        return True
    
    # Table has data - need to migrate with data copy
    print(f"  📊 Table has {row_count} rows. Creating migration...")
    
    # Create backup
    print("  💾 Creating backup...")
    backup_table_name = create_backup_table(client, table_name)
    
    if dry_run:
        print("  🔍 DRY RUN: Would execute the following migration:")
        print(f"    1. Create temp table with TIMESTAMP columns")
        print(f"    2. Copy data with CAST(DATETIME AS TIMESTAMP)")
        print(f"    3. Replace original table")
        return True
    
    # Step 1: Create temp table with TIMESTAMP columns
    temp_table_name = f"{table_name}_temp_timestamp"
    temp_table_ref = client.dataset(DATASET_ID).table(temp_table_name)
    
    # Build new schema
    new_schema = []
    for field in table.schema:
        if field.name in timestamp_columns and column_types.get(field.name) == "DATETIME":
            new_field = bigquery.SchemaField(
                name=field.name,
                field_type="TIMESTAMP",
                mode=field.mode,
                description=field.description,
            )
        else:
            new_field = field
        new_schema.append(new_field)
    
    temp_table = bigquery.Table(temp_table_ref, schema=new_schema)
    # Preserve table options
    if hasattr(table, 'clustering_fields') and table.clustering_fields:
        temp_table.clustering_fields = table.clustering_fields
    if hasattr(table, 'description'):
        temp_table.description = table.description
    if hasattr(table, 'labels') and table.labels:
        temp_table.labels = table.labels
    
    temp_table = client.create_table(temp_table)
    print(f"  ✅ Created temporary table: {temp_table_name}")
    
    # Step 2: Build SELECT query with CAST for DATETIME columns
    select_parts = []
    for field in table.schema:
        field_name = field.name
        if field_name in timestamp_columns and column_types.get(field_name) == "DATETIME":
            select_parts.append(f"CAST({field_name} AS TIMESTAMP) AS {field_name}")
        else:
            select_parts.append(field_name)
    
    copy_query = f"""
    INSERT INTO `{PROJECT_ID}.{DATASET_ID}.{temp_table_name}`
    SELECT {', '.join(select_parts)}
    FROM `{PROJECT_ID}.{DATASET_ID}.{table_name}`
    """
    
    print(f"  🔄 Copying data with type conversion...")
    job = client.query(copy_query)
    job.result()  # Wait for completion
    print(f"  ✅ Copied data to temporary table")
    
    # Step 3: Delete old table and copy temp table to original name
    client.delete_table(table_ref)
    print(f"  ✅ Deleted old table")
    
    # Copy temp table to original name
    temp_table_ref = client.dataset(DATASET_ID).table(temp_table_name)
    original_table_ref = client.dataset(DATASET_ID).table(table_name)
    
    # Copy the temp table to the original table name
    client.copy_table(temp_table_ref, original_table_ref)
    print(f"  ✅ Copied temporary table to {table_name}")
    
    # Delete the temp table
    client.delete_table(temp_table_ref)
    print(f"  ✅ Deleted temporary table")
    
    print(f"  ✅ Migration completed successfully!")
    return True


def main():
    """Main migration function."""
    print("=" * 70)
    print("Pay Template DATETIME to TIMESTAMP Migration")
    print("=" * 70)
    print(f"Project: {PROJECT_ID}")
    print(f"Dataset: {DATASET_ID}")
    print(f"Tables: {', '.join(TABLES_CONFIG.keys())}")
    
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
    for table_name, timestamp_columns in TABLES_CONFIG.items():
        try:
            success = migrate_table(client, table_name, timestamp_columns, dry_run=dry_run)
            results[table_name] = success
        except Exception as e:
            print(f"  ❌ ERROR migrating {table_name}: {e}")
            import traceback
            traceback.print_exc()
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
