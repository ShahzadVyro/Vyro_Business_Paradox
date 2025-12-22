#!/usr/bin/env python3
"""
Migration script to convert DATETIME columns to TIMESTAMP in Pay Template tables.

This script:
1. Checks current column types
2. For each table with DATETIME columns:
   - Creates a new table with TIMESTAMP columns
   - Copies data (converting DATETIME to TIMESTAMP)
   - Drops old table
   - Renames new table to original name
   - Preserves table options (clustering, labels, etc.)

Tables to migrate:
- Pay_Template_Increments: Created_At, Updated_At
- Pay_Template_Confirmations: Created_At, Updated_At, Approved_At
- Pay_Template_New_Hires: Created_At, Updated_At
- Pay_Template_Leavers: Created_At, Updated_At
"""

import os
import sys
from google.cloud import bigquery
from google.cloud.exceptions import NotFound

# Configuration
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "test-imagine-web")
DATASET_ID = os.getenv("BQ_DATASET", "Vyro_Business_Paradox")

TABLES_TO_MIGRATE = [
    {
        "table_name": "Pay_Template_Increments",
        "timestamp_columns": ["Created_At", "Updated_At"],
    },
    {
        "table_name": "Pay_Template_Confirmations",
        "timestamp_columns": ["Created_At", "Updated_At", "Approved_At"],
    },
    {
        "table_name": "Pay_Template_New_Hires",
        "timestamp_columns": ["Created_At", "Updated_At"],
    },
    {
        "table_name": "Pay_Template_Leavers",
        "timestamp_columns": ["Created_At", "Updated_At"],
    },
]

def get_table_schema(client, table_ref):
    """Get the current schema of a table."""
    try:
        table = client.get_table(table_ref)
        return table.schema
    except NotFound:
        print(f"Table {table_ref} not found. Skipping.")
        return None

def check_column_types(client, table_name):
    """Check if columns are DATETIME or TIMESTAMP."""
    query = f"""
    SELECT
      column_name,
      data_type
    FROM
      `{PROJECT_ID}.{DATASET_ID}.INFORMATION_SCHEMA.COLUMNS`
    WHERE
      table_name = '{table_name}'
      AND column_name IN ('Created_At', 'Updated_At', 'Approved_At')
    ORDER BY
      column_name;
    """
    
    results = client.query(query).result()
    column_types = {}
    for row in results:
        column_types[row.column_name] = row.data_type
    
    return column_types

def create_migration_table(client, table_ref, timestamp_columns):
    """Create a new table with TIMESTAMP columns instead of DATETIME."""
    table = client.get_table(table_ref)
    original_schema = table.schema
    
    # Create new schema with TIMESTAMP instead of DATETIME
    new_schema = []
    for field in original_schema:
        if field.name in timestamp_columns:
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
    
    # Create temporary table name
    temp_table_name = f"{table_ref.table_id}_migration_temp"
    temp_table_ref = f"{PROJECT_ID}.{DATASET_ID}.{temp_table_name}"
    
    # Create new table with TIMESTAMP columns
    new_table = bigquery.Table(temp_table_ref, schema=new_schema)
    new_table.clustering_fields = table.clustering_fields
    new_table.description = table.description
    new_table.labels = table.labels
    
    client.create_table(new_table)
    print(f"Created temporary table: {temp_table_name}")
    
    return temp_table_ref

def migrate_data(client, source_table_ref, dest_table_ref, timestamp_columns):
    """Copy data from source to destination, converting DATETIME to TIMESTAMP."""
    # Build column list
    source_table = client.get_table(source_table_ref)
    columns = [field.name for field in source_table.schema]
    
    # Build SELECT with CAST for timestamp columns
    select_clauses = []
    for col in columns:
        if col in timestamp_columns:
            select_clauses.append(f"CAST({col} AS TIMESTAMP) AS {col}")
        else:
            select_clauses.append(col)
    
    query = f"""
    INSERT INTO `{dest_table_ref}`
    SELECT {', '.join(select_clauses)}
    FROM `{source_table_ref}`
    """
    
    job = client.query(query)
    job.result()  # Wait for job to complete
    print(f"Migrated data from {source_table_ref.table_id} to {dest_table_ref}")

def migrate_table(client, table_config):
    """Migrate a single table from DATETIME to TIMESTAMP."""
    table_name = table_config["table_name"]
    timestamp_columns = table_config["timestamp_columns"]
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.{table_name}"
    
    print(f"\n{'='*80}")
    print(f"Migrating table: {table_name}")
    print(f"{'='*80}")
    
    # Check current column types
    column_types = check_column_types(client, table_name)
    if not column_types:
        print(f"No timestamp columns found in {table_name}. Skipping.")
        return False
    
    needs_migration = False
    for col_name, data_type in column_types.items():
        print(f"  {col_name}: {data_type}")
        if data_type == "DATETIME":
            needs_migration = True
    
    if not needs_migration:
        print(f"  ✓ All columns are already TIMESTAMP. No migration needed.")
        return True
    
    # Get full table reference
    full_table_ref = bigquery.TableReference(
        bigquery.DatasetReference(PROJECT_ID, DATASET_ID),
        table_name
    )
    
    # Create migration table
    temp_table_ref = create_migration_table(client, full_table_ref, timestamp_columns)
    
    # Migrate data
    temp_table_ref_obj = bigquery.TableReference(
        bigquery.DatasetReference(PROJECT_ID, DATASET_ID),
        temp_table_ref.split('.')[-1]
    )
    migrate_data(client, full_table_ref, temp_table_ref_obj, timestamp_columns)
    
    # Get row count for verification
    count_query = f"SELECT COUNT(*) as cnt FROM `{full_table_ref}`"
    source_count = list(client.query(count_query).result())[0].cnt
    
    count_query = f"SELECT COUNT(*) as cnt FROM `{temp_table_ref}`"
    dest_count = list(client.query(count_query).result())[0].cnt
    
    if source_count != dest_count:
        print(f"  ⚠️  WARNING: Row count mismatch! Source: {source_count}, Dest: {dest_count}")
        print(f"  Aborting migration. Temporary table {temp_table_ref} will be kept for inspection.")
        return False
    
    print(f"  ✓ Verified row count: {source_count} rows")
    
    # Drop original table
    client.delete_table(full_table_ref)
    print(f"  ✓ Dropped original table: {table_name}")
    
    # Rename temp table to original name
    temp_table = client.get_table(temp_table_ref_obj)
    temp_table.table_id = table_name
    client.create_table(temp_table)
    client.delete_table(temp_table_ref_obj)
    print(f"  ✓ Renamed {temp_table_ref.split('.')[-1]} to {table_name}")
    
    print(f"  ✅ Migration completed successfully!")
    return True

def main():
    """Main migration function."""
    print("="*80)
    print("PAY TEMPLATE TABLES: DATETIME TO TIMESTAMP MIGRATION")
    print("="*80)
    print(f"Project: {PROJECT_ID}")
    print(f"Dataset: {DATASET_ID}")
    print()
    
    # Initialize BigQuery client
    try:
        client = bigquery.Client(project=PROJECT_ID)
        print("✓ Connected to BigQuery")
    except Exception as e:
        print(f"❌ Failed to connect to BigQuery: {e}")
        sys.exit(1)
    
    # Check if tables exist and need migration
    print("\nChecking tables...")
    tables_to_process = []
    for table_config in TABLES_TO_MIGRATE:
        table_name = table_config["table_name"]
        table_ref = f"{PROJECT_ID}.{DATASET_ID}.{table_name}"
        try:
            client.get_table(table_ref)
            tables_to_process.append(table_config)
            print(f"  ✓ Found: {table_name}")
        except NotFound:
            print(f"  ⚠️  Not found: {table_name} (will be skipped)")
    
    if not tables_to_process:
        print("\n❌ No tables found to migrate. Exiting.")
        sys.exit(0)
    
    # Confirm before proceeding
    print(f"\n⚠️  This will migrate {len(tables_to_process)} table(s).")
    print("   The migration will:")
    print("   1. Create temporary tables with TIMESTAMP columns")
    print("   2. Copy and convert data from DATETIME to TIMESTAMP")
    print("   3. Drop original tables")
    print("   4. Rename temporary tables to original names")
    print()
    response = input("Proceed with migration? (yes/no): ")
    
    if response.lower() not in ['yes', 'y']:
        print("Migration cancelled.")
        sys.exit(0)
    
    # Migrate each table
    success_count = 0
    for table_config in tables_to_process:
        try:
            if migrate_table(client, table_config):
                success_count += 1
        except Exception as e:
            print(f"  ❌ Error migrating {table_config['table_name']}: {e}")
            import traceback
            traceback.print_exc()
    
    # Summary
    print("\n" + "="*80)
    print("MIGRATION SUMMARY")
    print("="*80)
    print(f"Tables processed: {len(tables_to_process)}")
    print(f"Successful: {success_count}")
    print(f"Failed: {len(tables_to_process) - success_count}")
    
    if success_count == len(tables_to_process):
        print("\n✅ All migrations completed successfully!")
    else:
        print("\n⚠️  Some migrations failed. Please review the output above.")

if __name__ == "__main__":
    main()
