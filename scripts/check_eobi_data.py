#!/usr/bin/env python3
"""
Check EOBI data in BigQuery to see what months have data.

Usage:
    python3 scripts/check_eobi_data.py
"""

import os
import sys
from google.cloud import bigquery
from google.oauth2 import service_account

# Configuration
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "test-imagine-web")
DATASET_ID = os.getenv("BQ_DATASET", "Vyro_Business_Paradox")
EOBI_TABLE = os.getenv("BQ_EOBI_TABLE", "Employee_EOBI")
CREDENTIALS_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "Credentials/test-imagine-web-18d4f9a43aef.json")

def get_bigquery_client():
    """Initialize BigQuery client."""
    credentials = service_account.Credentials.from_service_account_file(CREDENTIALS_PATH)
    return bigquery.Client(credentials=credentials, project=PROJECT_ID)

def check_eobi_data():
    """Check what EOBI data exists in the database."""
    client = get_bigquery_client()
    eobi_table_ref = f"{PROJECT_ID}.{DATASET_ID}.{EOBI_TABLE}"
    
    # Check distinct months
    query = f"""
    SELECT 
      FORMAT_DATE('%Y-%m', Payroll_Month) AS month,
      COUNT(DISTINCT Employee_ID) AS employee_count,
      COUNT(*) AS record_count
    FROM `{eobi_table_ref}`
    WHERE Payroll_Month IS NOT NULL
    GROUP BY month
    ORDER BY month DESC
    LIMIT 20
    """
    
    results = client.query(query).result()
    
    print("="*60)
    print("EOBI Data in Database")
    print("="*60)
    print(f"{'Month':<15} {'Employees':<12} {'Records':<10}")
    print("-"*60)
    
    months = []
    for row in results:
        months.append({
            'month': row.month,
            'employees': row.employee_count,
            'records': row.record_count
        })
        print(f"{row.month:<15} {row.employee_count:<12} {row.record_count:<10}")
    
    if not months:
        print("No EOBI data found in database!")
    else:
        print(f"\nTotal months with data: {len(months)}")
        
        # Check specifically for November 2025
        nov_query = f"""
        SELECT COUNT(*) as count
        FROM `{eobi_table_ref}`
        WHERE FORMAT_DATE('%Y-%m', Payroll_Month) = '2025-11'
        """
        nov_results = client.query(nov_query).result()
        for row in nov_results:
            print(f"\nNovember 2025 records: {row.count}")
            if row.count == 0:
                print("⚠️  November 2025 data is missing!")
                print("\nTo import November 2025 data, run:")
                print('python3 scripts/import_eobi_data.py "EOBI updated data- AI - To be uploaded November 2025 (1).csv"')

if __name__ == "__main__":
    check_eobi_data()
