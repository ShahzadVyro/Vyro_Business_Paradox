#!/usr/bin/env python3
"""
Add EOBI_Number column to Employees table in BigQuery.

This script adds the EOBI_Number column if it doesn't exist.
Run this before importing EOBI data.

Usage:
    python3 scripts/add_eobi_number_column.py
"""

import os
import sys
from google.cloud import bigquery
from google.oauth2 import service_account

# Configuration
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "test-imagine-web")
DATASET_ID = os.getenv("BQ_DATASET", "Vyro_Business_Paradox")
EMPLOYEES_TABLE = os.getenv("BQ_TABLE", "Employees")
CREDENTIALS_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "Credentials/test-imagine-web-18d4f9a43aef.json")

def get_bigquery_client():
    """Initialize BigQuery client."""
    credentials = service_account.Credentials.from_service_account_file(CREDENTIALS_PATH)
    return bigquery.Client(credentials=credentials, project=PROJECT_ID)

def check_column_exists(client, table_ref, column_name):
    """Check if a column exists in the table."""
    try:
        table = client.get_table(table_ref)
        column_names = [field.name for field in table.schema]
        return column_name in column_names
    except Exception as e:
        print(f"Error checking table schema: {e}")
        return False

def add_eobi_number_column(client):
    """Add EOBI_Number column to Employees table."""
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.{EMPLOYEES_TABLE}"
    
    # Check if column already exists
    if check_column_exists(client, table_ref, "EOBI_Number"):
        print(f"✓ Column EOBI_Number already exists in {EMPLOYEES_TABLE}")
        return True
    
    # Add the column
    query = f"""
    ALTER TABLE `{table_ref}`
    ADD COLUMN EOBI_Number STRING OPTIONS(description="Employees Old-Age Benefits Institution registration number")
    """
    
    try:
        query_job = client.query(query)
        query_job.result()  # Wait for completion
        print(f"✓ Successfully added EOBI_Number column to {EMPLOYEES_TABLE}")
        return True
    except Exception as e:
        error_msg = str(e)
        if "already exists" in error_msg.lower() or "duplicate" in error_msg.lower():
            print(f"✓ Column EOBI_Number already exists (detected via error message)")
            return True
        print(f"✗ Error adding column: {e}")
        return False

def main():
    print("="*60)
    print("Add EOBI_Number Column to Employees Table")
    print("="*60)
    print(f"Project: {PROJECT_ID}")
    print(f"Dataset: {DATASET_ID}")
    print(f"Table: {EMPLOYEES_TABLE}")
    print()
    
    client = get_bigquery_client()
    
    if add_eobi_number_column(client):
        print("\n" + "="*60)
        print("SUCCESS")
        print("="*60)
        print("The EOBI_Number column has been added to the Employees table.")
        print("You can now run the import script to update EOBI numbers.")
        print("\nNext steps:")
        print("1. Run: python3 scripts/import_eobi_data.py <csv_file_path>")
        print("2. The script will update Employees.EOBI_Number for each employee")
    else:
        print("\n" + "="*60)
        print("FAILED")
        print("="*60)
        print("Could not add EOBI_Number column. Please check the error above.")
        sys.exit(1)

if __name__ == "__main__":
    main()
