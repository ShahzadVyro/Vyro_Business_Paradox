#!/usr/bin/env python3
"""
Import Pay Template Data (New Hires, Leavers, Increments) to BigQuery

Usage:
    python scripts/import_pay_template_data.py <type> <csv_file_path> [month]
    
    type: "new-hires", "leavers", or "increments"
    csv_file_path: Path to CSV file
    month: Optional YYYY-MM format (will be extracted from dates if not provided)

Example:
    python scripts/import_pay_template_data.py new-hires new_hires_dec_2025.csv 2025-12
    python scripts/import_pay_template_data.py leavers leavers_dec_2025.csv 2025-12
    python scripts/import_pay_template_data.py increments increments_nov_dec_2025.csv
"""

import csv
import sys
import os
import re
from datetime import datetime
from typing import Optional, Dict, Any
from google.cloud import bigquery
from google.oauth2 import service_account

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configuration
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "test-imagine-web")
DATASET_ID = os.getenv("BQ_DATASET", "Vyro_Business_Paradox")
EMPLOYEES_TABLE = os.getenv("BQ_TABLE", "Employees")
SALARIES_TABLE = "Salaries"
CREDENTIALS_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "Credentials/test-imagine-web-18d4f9a43aef.json")

EMPLOYEES_TABLE_REF = f"`{PROJECT_ID}.{DATASET_ID}.{EMPLOYEES_TABLE}`"
SALARIES_TABLE_REF = f"`{PROJECT_ID}.{DATASET_ID}.{SALARIES_TABLE}`"

def get_bigquery_client():
    """Initialize BigQuery client."""
    credentials = service_account.Credentials.from_service_account_file(CREDENTIALS_PATH)
    return bigquery.Client(credentials=credentials, project=PROJECT_ID)

def parse_date(date_str: str) -> Optional[str]:
    """
    Parse various date formats to YYYY-MM-DD.
    Handles: "1 December 2025", "1st November 2025", "30th October 2025", "31 October", etc.
    """
    if not date_str or date_str.strip() == "":
        return None
    
    date_str = date_str.strip()
    
    # Remove ordinal suffixes (1st, 2nd, 3rd, 4th, etc.)
    date_str = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', date_str)
    
    # Month name mapping
    month_map = {
        "january": 1, "jan": 1,
        "february": 2, "feb": 2,
        "march": 3, "mar": 3,
        "april": 4, "apr": 4,
        "may": 5,
        "june": 6, "jun": 6,
        "july": 7, "jul": 7,
        "august": 8, "aug": 8,
        "september": 9, "sep": 9, "sept": 9,
        "october": 10, "oct": 10,
        "november": 11, "nov": 11,
        "december": 12, "dec": 12
    }
    
    # Try parsing formats
    patterns = [
        (r'(\d+)\s+(\w+)\s+(\d{4})', lambda m: (int(m.group(1)), month_map.get(m.group(2).lower()), int(m.group(3)))),
        (r'(\d+)\s+(\w+)', lambda m: (int(m.group(1)), month_map.get(m.group(2).lower()), datetime.now().year)),
    ]
    
    for pattern, extractor in patterns:
        match = re.match(pattern, date_str, re.IGNORECASE)
        if match:
            try:
                day, month_num, year = extractor(match)
                if month_num:
                    return f"{year}-{month_num:02d}-{day:02d}"
            except:
                continue
    
    # Fallback: try pandas datetime parsing
    try:
        import pandas as pd
        dt = pd.to_datetime(date_str, errors='coerce')
        if pd.notna(dt):
            return dt.strftime("%Y-%m-%d")
    except:
        pass
    
    return None

def extract_month_from_date(date_str: str) -> Optional[str]:
    """Extract YYYY-MM format from date string."""
    date = parse_date(date_str)
    if date:
        return date[:7]  # Return YYYY-MM
    return None

def clean_numeric(value: Any) -> Optional[float]:
    """Clean and convert numeric values, handling commas and N/A."""
    if value is None or value == "" or str(value).strip().lower() in ["n/a", "na", "-", ""]:
        return None
    
    if isinstance(value, (int, float)):
        return float(value)
    
    # Remove commas and spaces
    cleaned = str(value).replace(',', '').replace(' ', '').strip()
    if cleaned == "" or cleaned.lower() == "nan":
        return None
    
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None

def lookup_employee_id(bigquery_client, name: str, email: Optional[str] = None) -> Optional[str]:
    """Lookup Employee ID from Employees table by name or email."""
    try:
        query = f"""
        SELECT Employee_ID
        FROM {EMPLOYEES_TABLE_REF}
        WHERE Full_Name = @name
           OR Official_Email = @email
        LIMIT 1
        """
        
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("name", "STRING", name),
                bigquery.ScalarQueryParameter("email", "STRING", email or ""),
            ]
        )
        
        query_job = bigquery_client.query(query, job_config=job_config)
        results = query_job.result()
        
        for row in results:
            return str(row.Employee_ID)
        
        return None
    except Exception as e:
        print(f"Error looking up Employee ID for {name}: {e}")
        return None

def lookup_previous_salary(bigquery_client, employee_id: str, currency: str) -> Optional[float]:
    """Lookup Previous Salary from Salaries table or Employees table."""
    try:
        # First try: Salaries table (Gross_Income)
        query = f"""
        SELECT Gross_Income
        FROM {SALARIES_TABLE_REF}
        WHERE Employee_ID = @employeeId
          AND Currency = @currency
        ORDER BY Payroll_Month DESC
        LIMIT 1
        """
        
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("employeeId", "INT64", int(employee_id)),
                bigquery.ScalarQueryParameter("currency", "STRING", currency),
            ]
        )
        
        query_job = bigquery_client.query(query, job_config=job_config)
        results = query_job.result()
        
        for row in results:
            if row.Gross_Income is not None:
                return float(row.Gross_Income)
        
        # Second try: Employees table (Gross_Salary)
        query = f"""
        SELECT Gross_Salary
        FROM {EMPLOYEES_TABLE_REF}
        WHERE Employee_ID = @employeeId
        """
        
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("employeeId", "INT64", int(employee_id)),
            ]
        )
        
        query_job = bigquery_client.query(query, job_config=job_config)
        results = query_job.result()
        
        for row in results:
            if row.Gross_Salary is not None:
                return float(row.Gross_Salary)
        
        return None
    except Exception as e:
        print(f"Error looking up Previous Salary for Employee ID {employee_id}: {e}")
        return None

def import_new_hires(csv_path: str, month: Optional[str] = None):
    """Import new hires from CSV file."""
    bigquery_client = get_bigquery_client()
    table_ref = f"`{PROJECT_ID}.{DATASET_ID}.Pay_Template_New_Hires`"
    
    records = []
    lookup_count = 0
    
    print(f"\nReading new hires from: {csv_path}")
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Extract month from Date_of_Joining if not provided
            date_of_joining = row.get('Date of Joining', '').strip()
            record_month = month or extract_month_from_date(date_of_joining)
            
            if not record_month:
                print(f"Warning: Could not extract month from Date of Joining: {date_of_joining}")
                continue
            
            # Lookup Employee ID if missing
            employee_id = row.get('Employee ID', '').strip()
            employee_id_lookup = False
            
            if not employee_id and row.get('Employee Name'):
                looked_up_id = lookup_employee_id(
                    bigquery_client,
                    row['Employee Name'],
                    row.get('Official Email', '').strip() or None
                )
                if looked_up_id:
                    employee_id = looked_up_id
                    employee_id_lookup = True
                    lookup_count += 1
            
            # Parse date
            parsed_date = parse_date(date_of_joining)
            
            record = {
                'Type': 'New Hire',
                'Month': record_month,
                'Employee_ID': employee_id or None,
                'Employee_Name': row.get('Employee Name', '').strip(),
                'Designation': row.get('Designation', '').strip() or None,
                'Official_Email': row.get('Official Email', '').strip() or None,
                'Date_of_Joining': parsed_date,
                'Currency': row.get('Currency', 'PKR').strip(),
                'Salary': clean_numeric(row.get('Salary', 0)),
                'Employment_Location': row.get('Employment Location', '').strip() or None,
                'Bank_Name': row.get('Bank Name', '').strip() or None,
                'Bank_Account_Title': row.get('Bank Account Title', '').strip() or None,
                'Bank_Account_Number_IBAN': row.get('Bank Account Number-IBAN (24 digits)', '').strip() or None,
                'Swift_Code_BIC': row.get('Swift Code/ BIC Code', '').strip() or None,
                'Comments_by_Aun': row.get('Comments by Aun', '').strip() or None,
            }
            
            records.append(record)
    
    print(f"Processed {len(records)} new hire records")
    print(f"Looked up {lookup_count} Employee IDs")
    
    if not records:
        print("No records to insert.")
        return
    
    # Insert to BigQuery
    print(f"\nInserting {len(records)} records into {table_ref}...")
    
    errors = bigquery_client.insert_rows_json(table_ref, records)
    if errors:
        print(f"Errors occurred: {errors}")
    else:
        print(f"Successfully inserted {len(records)} new hire records!")

def import_leavers(csv_path: str, month: Optional[str] = None):
    """Import leavers from CSV file."""
    bigquery_client = get_bigquery_client()
    table_ref = f"`{PROJECT_ID}.{DATASET_ID}.Pay_Template_Leavers`"
    
    records = []
    lookup_count = 0
    
    print(f"\nReading leavers from: {csv_path}")
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Extract month from Employment End Date if not provided
            employment_end_date = row.get('Employment End Date', '').strip()
            record_month = month or extract_month_from_date(employment_end_date)
            
            if not record_month:
                print(f"Warning: Could not extract month from Employment End Date: {employment_end_date}")
                continue
            
            # Lookup Employee ID if missing
            employee_id = row.get('Employee ID', '').strip()
            employee_id_lookup = False
            
            if not employee_id and row.get('Employee Name'):
                looked_up_id = lookup_employee_id(bigquery_client, row['Employee Name'])
                if looked_up_id:
                    employee_id = looked_up_id
                    employee_id_lookup = True
                    lookup_count += 1
            
            # Parse date
            parsed_date = parse_date(employment_end_date)
            
            record = {
                'Type': 'Leaver',
                'Month': record_month,
                'Employee_ID': employee_id or None,
                'Employee_Name': row.get('Employee Name', '').strip(),
                'Employment_End_Date': parsed_date,
                'Payroll_Type': row.get('Payroll type', 'PKR').strip(),
                'Comments': row.get('Comments', '').strip() or None,
                'Devices_Returned': row.get('Devices Returned?', '').strip() or None,
                'Comments_by_Aun': row.get('Comments by Aun', '').strip() or None,
            }
            
            records.append(record)
    
    print(f"Processed {len(records)} leaver records")
    print(f"Looked up {lookup_count} Employee IDs")
    
    if not records:
        print("No records to insert.")
        return
    
    # Insert to BigQuery
    print(f"\nInserting {len(records)} records into {table_ref}...")
    
    errors = bigquery_client.insert_rows_json(table_ref, records)
    if errors:
        print(f"Errors occurred: {errors}")
    else:
        print(f"Successfully inserted {len(records)} leaver records!")

def import_increments(csv_path: str, month: Optional[str] = None):
    """Import increments from CSV file."""
    bigquery_client = get_bigquery_client()
    table_ref = f"`{PROJECT_ID}.{DATASET_ID}.Pay_Template_Increments`"
    
    records = []
    employee_id_lookup_count = 0
    salary_lookup_count = 0
    
    print(f"\nReading increments from: {csv_path}")
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Extract month from Effective date if not provided
            effective_date = row.get('Effective date', '').strip()
            record_month = month or extract_month_from_date(effective_date)
            
            if not record_month:
                print(f"Warning: Could not extract month from Effective date: {effective_date}")
                continue
            
            # Lookup Employee ID if missing
            employee_id = row.get('Employee ID', '').strip()
            employee_id_lookup = False
            
            if not employee_id and row.get('Employee Name'):
                looked_up_id = lookup_employee_id(bigquery_client, row['Employee Name'])
                if looked_up_id:
                    employee_id = looked_up_id
                    employee_id_lookup = True
                    employee_id_lookup_count += 1
            
            # Lookup Previous Salary if missing
            previous_salary = clean_numeric(row.get('Previous Salary', ''))
            previous_salary_lookup = False
            
            if previous_salary is None and employee_id and row.get('Currency'):
                looked_up_salary = lookup_previous_salary(bigquery_client, employee_id, row['Currency'])
                if looked_up_salary is not None:
                    previous_salary = looked_up_salary
                    previous_salary_lookup = True
                    salary_lookup_count += 1
            
            # Parse date
            parsed_date = parse_date(effective_date)
            
            record = {
                'Type': 'Increment',
                'Month': record_month,
                'Employee_ID': employee_id or None,
                'Employee_Name': row.get('Employee Name', '').strip(),
                'Currency': row.get('Currency', 'PKR').strip(),
                'Previous_Salary': previous_salary,
                'Updated_Salary': clean_numeric(row.get('Updated Salary', 0)),
                'Effective_Date': parsed_date,
                'Comments': row.get('Comments', '').strip() or None,
                'Remarks': row.get('Remarks', '').strip() or None,
            }
            
            records.append(record)
    
    print(f"Processed {len(records)} increment records")
    print(f"Looked up {employee_id_lookup_count} Employee IDs")
    print(f"Looked up {salary_lookup_count} Previous Salaries")
    
    if not records:
        print("No records to insert.")
        return
    
    # Insert to BigQuery
    print(f"\nInserting {len(records)} records into {table_ref}...")
    
    errors = bigquery_client.insert_rows_json(table_ref, records)
    if errors:
        print(f"Errors occurred: {errors}")
    else:
        print(f"Successfully inserted {len(records)} increment records!")

def main():
    if len(sys.argv) < 3:
        print("Usage: python scripts/import_pay_template_data.py <type> <csv_file_path> [month]")
        print("  type: 'new-hires', 'leavers', or 'increments'")
        print("  csv_file_path: Path to CSV file")
        print("  month: Optional YYYY-MM format (will be extracted from dates if not provided)")
        sys.exit(1)
    
    import_type = sys.argv[1].lower()
    csv_path = sys.argv[2]
    month = sys.argv[3] if len(sys.argv) > 3 else None
    
    if not os.path.exists(csv_path):
        print(f"Error: CSV file not found: {csv_path}")
        sys.exit(1)
    
    print("=" * 80)
    print("PAY TEMPLATE DATA IMPORT")
    print("=" * 80)
    print(f"Type: {import_type}")
    print(f"CSV File: {csv_path}")
    print(f"Month: {month or '(will be extracted from dates)'}")
    print("=" * 80)
    
    if import_type == "new-hires":
        import_new_hires(csv_path, month)
    elif import_type == "leavers":
        import_leavers(csv_path, month)
    elif import_type == "increments":
        import_increments(csv_path, month)
    else:
        print(f"Error: Unknown type '{import_type}'. Must be 'new-hires', 'leavers', or 'increments'")
        sys.exit(1)
    
    print("\n" + "=" * 80)
    print("IMPORT COMPLETED")
    print("=" * 80)

if __name__ == "__main__":
    main()
