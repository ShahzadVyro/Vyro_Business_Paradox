#!/usr/bin/env python3
"""
Migration Script: Add Updated_By Column to Employees Table

This script adds the missing Updated_By column to the Employees table.
The column is used to track who last updated an employee record.

The code in pay-template.ts expects this column to exist when updating employees.
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
TABLE_NAME = "Employees"
COLUMN_NAME = "Updated_By"


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


def check_column_exists(client, table_name, column_name):
    """Check if a column exists in the table."""
    query = f"""
    SELECT column_name
    FROM `{PROJECT_ID}.{DATASET_ID}.INFORMATION_SCHEMA.COLUMNS`
    WHERE table_name = '{table_name}'
      AND column_name = '{column_name}'
    """
    
    result = client.query(query).result()
    row = next(result, None)
    return row is not None


def check_table_exists(client, table_name):
    """Check if table exists."""
    table_ref = client.dataset(DATASET_ID).table(table_name)
    try:
        client.get_table(table_ref)
        return True
    except NotFound:
        return False


def add_updated_by_column(client, table_name, column_name, dry_run=True):
    """Add Updated_By column to Employees table."""
    print(f"\n📊 Processing table: {table_name}")
    
    # Check if table exists
    if not check_table_exists(client, table_name):
        print(f"  ❌ Table {table_name} does not exist!")
        return False
    
    # Check if column already exists
    print(f"  🔍 Checking if column {column_name} exists...")
    if check_column_exists(client, table_name, column_name):
        print(f"  ✅ Column {column_name} already exists. No migration needed.")
        return True
    
    print(f"  ❌ Column {column_name} does not exist. Adding column...")
    
    if dry_run:
        print("  🔍 DRY RUN: Would execute the following:")
        print(f"    ALTER TABLE `{PROJECT_ID}.{DATASET_ID}.{table_name}`")
        print(f"    ADD COLUMN IF NOT EXISTS {column_name} STRING OPTIONS(description='User/system that last updated record');")
        return True
    
    # Add the column
    alter_query = f"""
    ALTER TABLE `{PROJECT_ID}.{DATASET_ID}.{table_name}`
    ADD COLUMN IF NOT EXISTS {column_name} STRING OPTIONS(description="User/system that last updated record")
    """
    
    print(f"  🔄 Executing ALTER TABLE...")
    job = client.query(alter_query)
    job.result()  # Wait for completion
    print(f"  ✅ Column added successfully")
    
    # Verify the column was added
    print(f"  🔍 Verifying column was added...")
    if check_column_exists(client, table_name, column_name):
        print(f"  ✅ Verified: Column {column_name} now exists")
        
        # Get column details
        query = f"""
        SELECT column_name, data_type, is_nullable
        FROM `{PROJECT_ID}.{DATASET_ID}.INFORMATION_SCHEMA.COLUMNS`
        WHERE table_name = '{table_name}'
          AND column_name = '{column_name}'
        """
        result = client.query(query).result()
        row = next(result, None)
        if row:
            print(f"    Column type: {row.data_type}")
            print(f"    Nullable: {row.is_nullable}")
        
        return True
    else:
        print(f"  ❌ ERROR: Column {column_name} was not added!")
        return False


def main():
    """Main migration function."""
    print("=" * 70)
    print("Add Updated_By Column to Employees Table")
    print("=" * 70)
    print(f"Project: {PROJECT_ID}")
    print(f"Dataset: {DATASET_ID}")
    print(f"Table: {TABLE_NAME}")
    print(f"Column: {COLUMN_NAME}")
    
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
    
    try:
        success = add_updated_by_column(client, TABLE_NAME, COLUMN_NAME, dry_run=dry_run)
        
        if success:
            print("\n✅ Migration completed successfully!")
        else:
            print("\n❌ Migration failed. Please review errors above.")
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
