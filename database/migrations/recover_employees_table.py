#!/usr/bin/env python3
"""
Recovery Script: Restore Employees table from temp table

This script recovers the Employees table from Employees_temp_timestamp
after a failed migration.
"""

import os
import sys
from google.cloud import bigquery
from google.cloud.exceptions import NotFound
from google.oauth2 import service_account

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "test-imagine-web")
DATASET_ID = "Vyro_Business_Paradox"
TEMP_TABLE = "Employees_temp_timestamp"
ORIGINAL_TABLE = "Employees"

def get_bigquery_client():
    """Initialize BigQuery client."""
    credentials_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "Credentials/test-imagine-web-18d4f9a43aef.json")
    
    if not os.getenv("GOOGLE_APPLICATION_CREDENTIALS"):
        os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials_path
    
    if os.path.exists(credentials_path):
        credentials = service_account.Credentials.from_service_account_file(
            credentials_path,
            scopes=["https://www.googleapis.com/auth/bigquery"]
        )
        return bigquery.Client(credentials=credentials, project=PROJECT_ID)
    
    return bigquery.Client(project=PROJECT_ID)

def main():
    print("=" * 70)
    print("Recover Employees Table from Temp Table")
    print("=" * 70)
    
    client = get_bigquery_client()
    
    # Check if temp table exists
    temp_table_ref = client.dataset(DATASET_ID).table(TEMP_TABLE)
    try:
        temp_table = client.get_table(temp_table_ref)
        print(f"✅ Found temp table: {TEMP_TABLE}")
        print(f"   Row count: {temp_table.num_rows}")
    except NotFound:
        print(f"❌ Temp table {TEMP_TABLE} not found!")
        return
    
    # Check if original table exists
    original_table_ref = client.dataset(DATASET_ID).table(ORIGINAL_TABLE)
    try:
        original_table = client.get_table(original_table_ref)
        print(f"⚠️  Original table {ORIGINAL_TABLE} already exists!")
        response = input("Delete and replace? (yes/no): ")
        if response.lower() != "yes":
            print("Recovery cancelled.")
            return
        client.delete_table(original_table_ref)
        print(f"✅ Deleted existing {ORIGINAL_TABLE} table")
    except NotFound:
        print(f"ℹ️  Original table {ORIGINAL_TABLE} does not exist (expected)")
    
    # Copy temp table to original name
    print(f"\n🔄 Copying {TEMP_TABLE} to {ORIGINAL_TABLE}...")
    copy_job = client.copy_table(temp_table_ref, original_table_ref)
    copy_job.result()  # Wait for completion
    print(f"✅ Copied table successfully")
    
    # Verify the copy
    new_table = client.get_table(original_table_ref)
    print(f"✅ Verified: {ORIGINAL_TABLE} has {new_table.num_rows} rows")
    
    # Delete temp table
    print(f"\n🗑️  Deleting temp table {TEMP_TABLE}...")
    client.delete_table(temp_table_ref)
    print(f"✅ Deleted temp table")
    
    print("\n✅ Recovery completed successfully!")

if __name__ == "__main__":
    main()
