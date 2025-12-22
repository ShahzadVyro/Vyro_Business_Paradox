#!/usr/bin/env python3
"""
Migration script to add missing columns to Employee_Salaries table
for enhanced salary sheets functionality.
"""

import os
from google.cloud import bigquery
from google.oauth2 import service_account

# Configuration
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "test-imagine-web")
DATASET_ID = os.getenv("BQ_DATASET", "Vyro_Business_Paradox")
TABLE_ID = "Employee_Salaries"

# Path to credentials (adjust as needed)
CREDENTIALS_PATH = os.getenv(
    "GOOGLE_APPLICATION_CREDENTIALS",
    os.path.join(os.path.dirname(__file__), "../../Credentials/service_account.json")
)


def get_bigquery_client():
    """Initialize BigQuery client."""
    if os.path.exists(CREDENTIALS_PATH):
        credentials = service_account.Credentials.from_service_account_file(
            CREDENTIALS_PATH,
            scopes=["https://www.googleapis.com/auth/bigquery"],
        )
        return bigquery.Client(credentials=credentials, project=PROJECT_ID)
    else:
        return bigquery.Client(project=PROJECT_ID)


def add_columns():
    """Add missing columns to Employee_Salaries table."""
    client = get_bigquery_client()
    table_ref = client.dataset(DATASET_ID).table(TABLE_ID)
    
    # Read SQL migration file
    sql_file = os.path.join(os.path.dirname(__file__), "add_salary_sheet_columns.sql")
    with open(sql_file, "r") as f:
        sql = f.read()
    
    print(f"Adding columns to {PROJECT_ID}.{DATASET_ID}.{TABLE_ID}...")
    
    try:
        query_job = client.query(sql)
        query_job.result()  # Wait for job to complete
        print("✓ Successfully added columns to Employee_Salaries table")
        return True
    except Exception as e:
        print(f"✗ Error adding columns: {e}")
        return False


if __name__ == "__main__":
    success = add_columns()
    exit(0 if success else 1)
