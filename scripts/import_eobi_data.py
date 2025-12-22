#!/usr/bin/env python3
"""
Import EOBI data from CSV file and update Employees table with EOBI numbers and missing data.

Usage:
    python scripts/import_eobi_data.py <csv_file_path>
"""

import csv
import sys
import os
from datetime import datetime
from google.cloud import bigquery
from google.oauth2 import service_account

# Add parent directory to path to import config
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configuration - Update these based on your setup
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "test-imagine-web")
DATASET_ID = os.getenv("BQ_DATASET", "Vyro_Business_Paradox")
EMPLOYEES_TABLE = os.getenv("BQ_TABLE", "Employees")
EOBI_TABLE = os.getenv("BQ_EOBI_TABLE", "Employee_EOBI")
CREDENTIALS_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "Credentials/test-imagine-web-18d4f9a43aef.json")

def get_bigquery_client():
    """Initialize BigQuery client."""
    credentials = service_account.Credentials.from_service_account_file(CREDENTIALS_PATH)
    return bigquery.Client(credentials=credentials, project=PROJECT_ID)

def parse_eobi_date(date_str):
    """Parse EOBI date format (DD-MMM-YY) to YYYY-MM-DD."""
    if not date_str or date_str.strip() == "":
        return None
    try:
        # Handle formats like "12-Apr-04", "1-November-25"
        date_str = date_str.strip()
        parts = date_str.split("-")
        if len(parts) == 3:
            day = parts[0]
            month_str = parts[1]
            year_str = parts[2]
            
            # Map month names
            month_map = {
                "jan": 1, "january": 1,
                "feb": 2, "february": 2,
                "mar": 3, "march": 3,
                "apr": 4, "april": 4,
                "may": 5,
                "jun": 6, "june": 6,
                "jul": 7, "july": 7,
                "aug": 8, "august": 8,
                "sep": 9, "september": 9,
                "oct": 10, "october": 10,
                "nov": 11, "november": 11,
                "dec": 12, "december": 12
            }
            
            month = month_map.get(month_str.lower(), None)
            if not month:
                return None
            
            # Handle 2-digit year (assume 2000s for years < 50, 1900s for years >= 50)
            year = int(year_str)
            if year < 50:
                year = 2000 + year
            else:
                year = 1900 + year
            
            return f"{year}-{month:02d}-{int(day):02d}"
    except Exception as e:
        print(f"Error parsing date '{date_str}': {e}")
        return None
    return None

def read_eobi_csv(file_path):
    """Read EOBI CSV file and return list of records."""
    records = []
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Clean up column names (remove extra spaces and parentheses)
            cleaned_row = {}
            for key, value in row.items():
                # Remove parenthetical descriptions from headers
                clean_key = key.split('(')[0].strip()
                cleaned_row[clean_key] = value.strip() if value else ""
            
            records.append(cleaned_row)
    return records

def match_employee(client, name, cnic):
    """Find employee in BigQuery by name or CNIC."""
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.{EMPLOYEES_TABLE}"
    
    # Try matching by CNIC first (more reliable)
    if cnic:
        query = f"""
        SELECT Employee_ID, Full_Name, CNIC_ID
        FROM `{table_ref}`
        WHERE CNIC_ID = @cnic
        LIMIT 1
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("cnic", "STRING", cnic)
            ]
        )
        results = client.query(query, job_config=job_config).result()
        for row in results:
            return row.Employee_ID, row.Full_Name
    
    # Fallback to name matching
    if name:
        query = f"""
        SELECT Employee_ID, Full_Name, CNIC_ID
        FROM `{table_ref}`
        WHERE LOWER(TRIM(Full_Name)) = LOWER(TRIM(@name))
        LIMIT 1
        """
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("name", "STRING", name)
            ]
        )
        results = client.query(query, job_config=job_config).result()
        for row in results:
            return row.Employee_ID, row.Full_Name
    
    return None, None

def extract_payroll_month(file_path):
    """Extract payroll month from CSV filename.
    
    Examples:
        "EOBI updated data- AI - To be uploaded November 2025 (1).csv" -> "2025-11-01"
        "eobi-november-2025.csv" -> "2025-11-01"
    """
    import re
    filename = os.path.basename(file_path)
    
    # Try to find month and year in filename
    month_map = {
        "january": 1, "jan": 1,
        "february": 2, "feb": 2,
        "march": 3, "mar": 3,
        "april": 4, "apr": 4,
        "may": 5,
        "june": 6, "jun": 6,
        "july": 7, "jul": 7,
        "august": 8, "aug": 8,
        "september": 9, "sep": 9,
        "october": 10, "oct": 10,
        "november": 11, "nov": 11,
        "december": 12, "dec": 12
    }
    
    # Look for pattern like "November 2025" or "Nov 2025"
    pattern = r'(\w+)\s+(\d{4})'
    match = re.search(pattern, filename, re.IGNORECASE)
    
    if match:
        month_str = match.group(1).lower()
        year = int(match.group(2))
        month = month_map.get(month_str)
        if month:
            return f"{year}-{month:02d}-01"
    
    # Default to current month if not found
    now = datetime.now()
    return f"{now.year}-{now.month:02d}-01"

def get_next_eobi_id(client):
    """Get the next available EOBI_ID."""
    eobi_table_ref = f"{PROJECT_ID}.{DATASET_ID}.{EOBI_TABLE}"
    query = f"""
    SELECT COALESCE(MAX(EOBI_ID), 0) + 1 AS next_id
    FROM `{eobi_table_ref}`
    """
    results = client.query(query).result()
    for row in results:
        return row.next_id
    return 1

def check_eobi_record_exists(client, employee_id, payroll_month):
    """Check if EOBI record already exists for this employee and month."""
    eobi_table_ref = f"{PROJECT_ID}.{DATASET_ID}.{EOBI_TABLE}"
    query = f"""
    SELECT COUNT(1) as count
    FROM `{eobi_table_ref}`
    WHERE SAFE_CAST(Employee_ID AS INT64) = @employee_id
      AND Payroll_Month = @payroll_month
    """
    job_config = bigquery.QueryJobConfig(
        query_parameters=[
            bigquery.ScalarQueryParameter("employee_id", "INT64", employee_id),
            bigquery.ScalarQueryParameter("payroll_month", "DATE", payroll_month)
        ]
    )
    results = client.query(query, job_config=job_config).result()
    for row in results:
        return row.count > 0
    return False

def insert_eobi_record(client, employee_id, eobi_data, payroll_month_date):
    """Insert EOBI record into Employee_EOBI table.
    
    Args:
        client: BigQuery client
        employee_id: Employee ID (INT64)
        eobi_data: Dictionary with EOBI fields from CSV
        payroll_month_date: Date string in YYYY-MM-DD format (first day of month)
    
    Returns:
        True if inserted, False if skipped (duplicate or error), or error message string
    """
    eobi_table_ref = f"{PROJECT_ID}.{DATASET_ID}.{EOBI_TABLE}"
    
    # Don't check for duplicates - let INSERT handle it
    # This ensures we try to insert all records
    
    # Get next EOBI_ID
    eobi_id = get_next_eobi_id(client)
    
    # Parse dates
    dob = parse_eobi_date(eobi_data.get("DOB", ""))
    doj = parse_eobi_date(eobi_data.get("DOJ", ""))
    doe = parse_eobi_date(eobi_data.get("DOE", ""))
    from_date = parse_eobi_date(eobi_data.get("From_Date", ""))
    to_date = parse_eobi_date(eobi_data.get("To_Date", ""))
    
    # Parse numeric fields
    try:
        days_worked = float(eobi_data.get("NO_OF_DAYS_WORKED", "0") or "0")
    except:
        days_worked = 0
    
    # Build insert query
    query = f"""
    INSERT INTO `{eobi_table_ref}` (
        EOBI_ID,
        Employee_ID,
        Payroll_Month,
        EMP_AREA_CODE,
        EMP_REG_SERIAL_NO,
        EMP_SUB_AREA_CODE,
        EMP_SUB_SERIAL_NO,
        EOBI_NO,
        DOB,
        DOJ,
        DOE,
        NO_OF_DAYS_WORKED,
        From_Date,
        To_Date,
        Loaded_At,
        Created_At
    ) VALUES (
        @eobi_id,
        @employee_id,
        @payroll_month,
        @emp_area_code,
        @emp_reg_serial_no,
        @emp_sub_area_code,
        @emp_sub_serial_no,
        @eobi_no,
        @dob,
        @doj,
        @doe,
        @days_worked,
        @from_date,
        @to_date,
        CURRENT_TIMESTAMP(),
        CURRENT_TIMESTAMP()
    )
    """
    
    params = [
        bigquery.ScalarQueryParameter("eobi_id", "INT64", eobi_id),
        bigquery.ScalarQueryParameter("employee_id", "INT64", employee_id),
        bigquery.ScalarQueryParameter("payroll_month", "DATE", payroll_month_date),
        bigquery.ScalarQueryParameter("emp_area_code", "STRING", eobi_data.get("EMP_AREA_CODE", "FAA") or "FAA"),
        bigquery.ScalarQueryParameter("emp_reg_serial_no", "STRING", eobi_data.get("EMP_REG_SERIAL_NO", "4320") or "4320"),
        bigquery.ScalarQueryParameter("emp_sub_area_code", "STRING", eobi_data.get("EMP_SUB_AREA_CODE", " ") or " "),
        bigquery.ScalarQueryParameter("emp_sub_serial_no", "STRING", eobi_data.get("EMP_SUB_SERIAL_NO", "0") or "0"),
        bigquery.ScalarQueryParameter("eobi_no", "STRING", eobi_data.get("EOBI_NO", "") or ""),
        bigquery.ScalarQueryParameter("dob", "DATE", dob if dob else None),
        bigquery.ScalarQueryParameter("doj", "DATE", doj if doj else None),
        bigquery.ScalarQueryParameter("doe", "DATE", doe if doe else None),
        bigquery.ScalarQueryParameter("days_worked", "NUMERIC", days_worked),
        bigquery.ScalarQueryParameter("from_date", "DATE", from_date if from_date else None),
        bigquery.ScalarQueryParameter("to_date", "DATE", to_date if to_date else None),
    ]
    
    job_config = bigquery.QueryJobConfig(query_parameters=params)
    try:
        query_job = client.query(query, job_config=job_config)
        query_job.result()  # Wait for completion
        return True
    except Exception as e:
        error_msg = str(e)
        # Check if it's a duplicate error
        if "duplicate" in error_msg.lower() or "already exists" in error_msg.lower():
            return False  # Silent skip for duplicates
        # Return error message for other errors
        return error_msg

def update_employee_eobi(client, employee_id, eobi_data):
    """Update employee record with EOBI data."""
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.{EMPLOYEES_TABLE}"
    
    updates = []
    params = []
    
    # EOBI Number
    if eobi_data.get("EOBI_NO"):
        updates.append("EOBI_Number = @eobi_no")
        params.append(bigquery.ScalarQueryParameter("eobi_no", "STRING", eobi_data["EOBI_NO"]))
    
    # Date of Birth (if missing)
    if eobi_data.get("DOB"):
        dob = parse_eobi_date(eobi_data["DOB"])
        if dob:
            updates.append("Date_of_Birth = @dob")
            params.append(bigquery.ScalarQueryParameter("dob", "DATE", dob))
    
    # Joining Date (if missing or to verify)
    if eobi_data.get("DOJ"):
        doj = parse_eobi_date(eobi_data["DOJ"])
        if doj:
            updates.append("Joining_Date = @doj")
            params.append(bigquery.ScalarQueryParameter("doj", "DATE", doj))
    
    # CNIC (if missing)
    if eobi_data.get("CNIC"):
        updates.append("CNIC_ID = @cnic")
        params.append(bigquery.ScalarQueryParameter("cnic", "STRING", eobi_data["CNIC"]))
    
    if not updates:
        return False
    
    # Build update query
    query = f"""
    UPDATE `{table_ref}`
    SET {', '.join(updates)}, Updated_At = CURRENT_DATETIME()
    WHERE Employee_ID = @employee_id
    """
    
    params.append(bigquery.ScalarQueryParameter("employee_id", "INT64", employee_id))
    
    job_config = bigquery.QueryJobConfig(query_parameters=params)
    try:
        query_job = client.query(query, job_config=job_config)
        query_job.result()  # Wait for completion
        return True
    except Exception as e:
        print(f"    ⚠ Error updating Employees table: {e}")
        raise

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/import_eobi_data.py <csv_file_path>")
        sys.exit(1)
    
    csv_file = sys.argv[1]
    
    if not os.path.exists(csv_file):
        print(f"Error: CSV file not found: {csv_file}")
        sys.exit(1)
    
    print(f"Reading EOBI data from: {csv_file}")
    eobi_records = read_eobi_csv(csv_file)
    print(f"Found {len(eobi_records)} records in CSV")
    
    # Extract payroll month from filename
    payroll_month = extract_payroll_month(csv_file)
    print(f"Detected Payroll Month: {payroll_month}")
    
    client = get_bigquery_client()
    
    matched = 0
    updated = 0
    inserted = 0
    skipped_duplicates = 0
    not_found = []
    
    for idx, record in enumerate(eobi_records, 1):
        name = record.get("NAME", "").strip()
        cnic = record.get("CNIC", "").strip()
        eobi_no = record.get("EOBI_NO", "").strip()
        
        if not name:
            print(f"  [{idx}/{len(eobi_records)}] Skipping record - no name")
            continue
        
        print(f"  [{idx}/{len(eobi_records)}] Processing: {name} (EOBI: {eobi_no})")
        
        # Find employee
        employee_id, employee_name = match_employee(client, name, cnic)
        
        if not employee_id:
            not_found.append({"name": name, "cnic": cnic, "eobi_no": eobi_no})
            print(f"    ❌ Employee not found")
            continue
        
        matched += 1
        print(f"    ✓ Found: Employee ID {employee_id} ({employee_name})")
        
        # Insert into Employee_EOBI table
        insert_result = insert_eobi_record(client, employee_id, record, payroll_month)
        if insert_result is True:
            inserted += 1
            if idx % 20 == 0:  # Print every 20th to reduce noise
                print(f"    ✓ Inserted {inserted} records so far...")
        elif insert_result is False:
            skipped_duplicates += 1
            # Don't print for every skipped duplicate to reduce noise
        else:
            # insert_result contains error message
            skipped_duplicates += 1
            if "duplicate" not in str(insert_result).lower():
                print(f"    ⚠ Error for {name}: {str(insert_result)[:100]}")
        
        # Update Employees table with EOBI number and missing fields
        if update_employee_eobi(client, employee_id, record):
            updated += 1
            print(f"    ✓ Updated Employees table")
    
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Total records processed: {len(eobi_records)}")
    print(f"Payroll Month: {payroll_month}")
    print(f"Employees matched: {matched}")
    print(f"EOBI records inserted: {inserted}")
    print(f"EOBI records skipped (duplicates): {skipped_duplicates}")
    print(f"Employees table updated: {updated}")
    print(f"Employees not found: {len(not_found)}")
    
    if not_found:
        print("\nEmployees not found:")
        for nf in not_found[:10]:  # Show first 10
            print(f"  - {nf['name']} (CNIC: {nf['cnic']}, EOBI: {nf['eobi_no']})")
        if len(not_found) > 10:
            print(f"  ... and {len(not_found) - 10} more")

if __name__ == "__main__":
    main()
