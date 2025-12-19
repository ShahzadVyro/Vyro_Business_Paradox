#!/usr/bin/env python3
"""
Check Employment_End_Date, Probation_Period_Months, and Probation_End_Date
data completeness in Employees and Offboarding tables.

Usage:
    python3 scripts/check_employment_and_probation_dates.py
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
EMPLOYEES_TABLE = os.getenv("BQ_TABLE", "Employees")
OFFBOARDING_TABLE = os.getenv("BQ_OFFBOARDING_TABLE", "EmployeeOffboarding_v1")

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

def check_column_exists(client, dataset_id, table_name, column_name):
    """Check if a column exists in a table"""
    try:
        query = f"""
        SELECT column_name, data_type, is_nullable
        FROM `{PROJECT_ID}.{dataset_id}.INFORMATION_SCHEMA.COLUMNS`
        WHERE table_name = @table_name
          AND column_name = @column_name
        """
        results = client.query(query, job_config=bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("table_name", "STRING", table_name),
                bigquery.ScalarQueryParameter("column_name", "STRING", column_name),
            ]
        )).result()
        
        rows = list(results)
        if rows:
            return True, rows[0]
        return False, None
    except Exception as e:
        print(f"Error checking column {column_name} in {table_name}: {e}")
        return False, None

def get_table_stats(client, dataset_id, table_name):
    """Get statistics about the Employees table"""
    table_ref = f"`{PROJECT_ID}.{dataset_id}.{table_name}`"
    
    # Check if Probation_Period_Months exists
    has_probation_period, _ = check_column_exists(client, dataset_id, table_name, "Probation_Period_Months")
    
    queries = {
        "total_employees": f"""
            SELECT COUNT(*) as count
            FROM {table_ref}
        """,
        "resigned_terminated": f"""
            SELECT COUNT(*) as count
            FROM {table_ref}
            WHERE Employment_Status IN ('Resigned/Terminated', 'Resigned', 'Terminated')
        """,
        "null_employment_end_date": f"""
            SELECT COUNT(*) as count
            FROM {table_ref}
            WHERE Employment_Status IN ('Resigned/Terminated', 'Resigned', 'Terminated')
              AND Employment_End_Date IS NULL
        """,
        "null_probation_end_date": f"""
            SELECT COUNT(*) as count
            FROM {table_ref}
            WHERE Joining_Date IS NOT NULL
              AND Probation_End_Date IS NULL
        """,
    }
    
    # Only add Probation_Period_Months queries if column exists
    if has_probation_period:
        queries["null_probation_period"] = f"""
            SELECT COUNT(*) as count
            FROM {table_ref}
            WHERE Probation_Period_Months IS NULL
        """
        queries["has_joining_date_no_probation"] = f"""
            SELECT COUNT(*) as count
            FROM {table_ref}
            WHERE Joining_Date IS NOT NULL
              AND (Probation_Period_Months IS NULL OR Probation_End_Date IS NULL)
        """
    else:
        queries["null_probation_period"] = None
        queries["has_joining_date_no_probation"] = f"""
            SELECT COUNT(*) as count
            FROM {table_ref}
            WHERE Joining_Date IS NOT NULL
              AND Probation_End_Date IS NULL
        """
    
    stats = {}
    for key, query in queries.items():
        if query is None:
            stats[key] = None
            continue
        try:
            results = client.query(query).result()
            stats[key] = list(results)[0].count
        except Exception as e:
            print(f"Error running query {key}: {e}")
            stats[key] = None
    
    return stats

def compare_employment_end_dates(client, dataset_id, employees_table, offboarding_table):
    """Compare Employment_End_Date between Employees and Offboarding tables"""
    employees_ref = f"`{PROJECT_ID}.{dataset_id}.{employees_table}`"
    offboarding_ref = f"`{PROJECT_ID}.{dataset_id}.{offboarding_table}`"
    
    # Cast both to DATE for comparison since Offboarding might be STRING
    query = f"""
    SELECT 
        e.Employee_ID,
        e.Full_Name,
        e.Employment_Status,
        e.Employment_End_Date as Employees_End_Date,
        CAST(o.Employment_End_Date AS DATE) as Offboarding_End_Date,
        CASE 
            WHEN e.Employment_End_Date IS NULL AND o.Employment_End_Date IS NOT NULL THEN 'Missing in Employees'
            WHEN e.Employment_End_Date IS NOT NULL AND o.Employment_End_Date IS NULL THEN 'Missing in Offboarding'
            WHEN CAST(e.Employment_End_Date AS DATE) != CAST(o.Employment_End_Date AS DATE) THEN 'Mismatch'
            ELSE 'Match'
        END as status
    FROM {employees_ref} e
    LEFT JOIN {offboarding_ref} o 
        ON CAST(e.Employee_ID AS STRING) = o.Employee_ID
    WHERE e.Employment_Status IN ('Resigned/Terminated', 'Resigned', 'Terminated')
    ORDER BY e.Employee_ID
    LIMIT 20
    """
    
    try:
        results = client.query(query).result()
        return list(results)
    except Exception as e:
        print(f"Error comparing dates: {e}")
        return []

def get_sample_resigned_employees(client, dataset_id, table_name):
    """Get sample data for resigned/terminated employees"""
    table_ref = f"`{PROJECT_ID}.{dataset_id}.{table_name}`"
    
    # Check if Probation_Period_Months exists
    has_probation_period, _ = check_column_exists(client, dataset_id, table_name, "Probation_Period_Months")
    
    # Build SELECT clause conditionally
    if has_probation_period:
        select_clause = "Employee_ID, Full_Name, Employment_Status, Joining_Date, Employment_End_Date, Probation_Period_Months, Probation_End_Date"
    else:
        select_clause = "Employee_ID, Full_Name, Employment_Status, Joining_Date, Employment_End_Date, NULL as Probation_Period_Months, Probation_End_Date"
    
    query = f"""
    SELECT 
        {select_clause}
    FROM {table_ref}
    WHERE Employment_Status IN ('Resigned/Terminated', 'Resigned', 'Terminated')
    ORDER BY Employee_ID
    LIMIT 10
    """
    
    try:
        results = client.query(query).result()
        return list(results)
    except Exception as e:
        print(f"Error getting sample data: {e}")
        return []

def main():
    """Main function"""
    print("="*80)
    print("Employment End Date and Probation Period Diagnostic")
    print("="*80)
    print()
    
    client = get_bigquery_client()
    
    # Check column existence
    print("1. Checking Column Existence")
    print("-"*80)
    
    columns_to_check = [
        ("Employment_End_Date", "DATE"),
        ("Probation_Period_Months", "INT64"),
        ("Probation_End_Date", "DATE"),
        ("Joining_Date", "DATE"),
    ]
    
    for col_name, expected_type in columns_to_check:
        exists, info = check_column_exists(client, DATASET_ID, EMPLOYEES_TABLE, col_name)
        if exists:
            print(f"✓ {col_name}: EXISTS ({info.data_type})")
        else:
            print(f"✗ {col_name}: MISSING")
    
    print()
    
    # Get table statistics
    print("2. Table Statistics")
    print("-"*80)
    
    stats = get_table_stats(client, DATASET_ID, EMPLOYEES_TABLE)
    
    print(f"Total Employees: {stats.get('total_employees', 'N/A')}")
    print(f"Resigned/Terminated: {stats.get('resigned_terminated', 'N/A')}")
    print(f"Resigned/Terminated with NULL Employment_End_Date: {stats.get('null_employment_end_date', 'N/A')}")
    print(f"Employees with NULL Probation_Period_Months: {stats.get('null_probation_period', 'N/A')}")
    print(f"Employees with Joining_Date but NULL Probation_End_Date: {stats.get('null_probation_end_date', 'N/A')}")
    print(f"Employees with Joining_Date missing probation data: {stats.get('has_joining_date_no_probation', 'N/A')}")
    print()
    
    # Compare Employment_End_Date between tables
    print("3. Comparing Employment_End_Date (Employees vs Offboarding)")
    print("-"*80)
    
    try:
        comparisons = compare_employment_end_dates(client, DATASET_ID, EMPLOYEES_TABLE, OFFBOARDING_TABLE)
        if comparisons:
            print(f"{'Employee ID':<12} {'Name':<30} {'Employees':<15} {'Offboarding':<15} {'Status':<20}")
            print("-"*80)
            for row in comparisons[:10]:
                emp_id = str(row.Employee_ID) if row.Employee_ID else "N/A"
                name = (row.Full_Name or "N/A")[:28]
                emp_date = str(row.Employees_End_Date) if row.Employees_End_Date else "NULL"
                off_date = str(row.Offboarding_End_Date) if row.Offboarding_End_Date else "NULL"
                status = row.status
                print(f"{emp_id:<12} {name:<30} {emp_date:<15} {off_date:<15} {status:<20}")
        else:
            print("No comparison data available (Offboarding table may not exist)")
    except Exception as e:
        print(f"Could not compare tables: {e}")
    
    print()
    
    # Sample data
    print("4. Sample Resigned/Terminated Employee Data")
    print("-"*80)
    
    samples = get_sample_resigned_employees(client, DATASET_ID, EMPLOYEES_TABLE)
    if samples:
        print(f"{'Employee ID':<12} {'Name':<25} {'Status':<20} {'Joining':<12} {'End Date':<12} {'Prob Period':<12} {'Prob End':<12}")
        print("-"*80)
        for row in samples:
            emp_id = str(row.Employee_ID) if row.Employee_ID else "N/A"
            name = (row.Full_Name or "N/A")[:23]
            status = (row.Employment_Status or "N/A")[:18]
            joining = str(row.Joining_Date) if row.Joining_Date else "NULL"
            end_date = str(row.Employment_End_Date) if row.Employment_End_Date else "NULL"
            prob_period = str(row.Probation_Period_Months) if row.Probation_Period_Months else "NULL"
            prob_end = str(row.Probation_End_Date) if row.Probation_End_Date else "NULL"
            print(f"{emp_id:<12} {name:<25} {status:<20} {joining:<12} {end_date:<12} {prob_period:<12} {prob_end:<12}")
    else:
        print("No sample data available")
    
    print()
    print("="*80)
    print("Diagnostic Complete")
    print("="*80)

if __name__ == "__main__":
    main()
