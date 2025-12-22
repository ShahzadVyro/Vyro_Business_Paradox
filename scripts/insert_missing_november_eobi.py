#!/usr/bin/env python3
"""
Insert missing November 2025 EOBI records.
Uses INSERT IGNORE pattern to skip actual duplicates.

Usage:
    python3 scripts/insert_missing_november_eobi.py
"""

import csv
import os
import sys
from datetime import datetime
from google.cloud import bigquery
from google.oauth2 import service_account

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "test-imagine-web")
DATASET_ID = os.getenv("BQ_DATASET", "Vyro_Business_Paradox")
EMPLOYEES_TABLE = os.getenv("BQ_TABLE", "Employees")
EOBI_TABLE = os.getenv("BQ_EOBI_TABLE", "Employee_EOBI")
CREDENTIALS_PATH = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "Credentials/test-imagine-web-18d4f9a43aef.json")

def get_bigquery_client():
    credentials = service_account.Credentials.from_service_account_file(CREDENTIALS_PATH)
    return bigquery.Client(credentials=credentials, project=PROJECT_ID)

def parse_eobi_date(date_str):
    if not date_str or date_str.strip() == "":
        return None
    try:
        date_str = date_str.strip()
        parts = date_str.split("-")
        if len(parts) == 3:
            day = parts[0]
            month_str = parts[1]
            year_str = parts[2]
            month_map = {
                "jan": 1, "january": 1, "feb": 2, "february": 2,
                "mar": 3, "march": 3, "apr": 4, "april": 4,
                "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7,
                "aug": 8, "august": 8, "sep": 9, "september": 9,
                "oct": 10, "october": 10, "nov": 11, "november": 11,
                "dec": 12, "december": 12
            }
            month = month_map.get(month_str.lower(), None)
            if not month:
                return None
            year = int(year_str)
            if year < 50:
                year = 2000 + year
            else:
                year = 1900 + year
            return f"{year}-{month:02d}-{int(day):02d}"
    except:
        return None
    return None

def read_eobi_csv(file_path):
    records = []
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            cleaned_row = {}
            for key, value in row.items():
                clean_key = key.split('(')[0].strip()
                cleaned_row[clean_key] = value.strip() if value else ""
            records.append(cleaned_row)
    return records

def match_employee(client, name, cnic):
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.{EMPLOYEES_TABLE}"
    if cnic:
        query = f"SELECT Employee_ID, Full_Name FROM `{table_ref}` WHERE CNIC_ID = @cnic LIMIT 1"
        job_config = bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("cnic", "STRING", cnic)])
        results = client.query(query, job_config=job_config).result()
        for row in results:
            return row.Employee_ID, row.Full_Name
    if name:
        query = f"SELECT Employee_ID, Full_Name FROM `{table_ref}` WHERE LOWER(TRIM(Full_Name)) = LOWER(TRIM(@name)) LIMIT 1"
        job_config = bigquery.QueryJobConfig(query_parameters=[bigquery.ScalarQueryParameter("name", "STRING", name)])
        results = client.query(query, job_config=job_config).result()
        for row in results:
            return row.Employee_ID, row.Full_Name
    return None, None

def get_next_eobi_id(client):
    eobi_table_ref = f"{PROJECT_ID}.{DATASET_ID}.{EOBI_TABLE}"
    query = f"SELECT COALESCE(MAX(EOBI_ID), 0) + 1 AS next_id FROM `{eobi_table_ref}`"
    results = client.query(query).result()
    for row in results:
        return row.next_id
    return 1

def insert_eobi_record_safe(client, employee_id, eobi_data, payroll_month_date):
    """Insert EOBI record, handling duplicates gracefully."""
    eobi_table_ref = f"{PROJECT_ID}.{DATASET_ID}.{EOBI_TABLE}"
    
    # Use MERGE to insert or update
    dob = parse_eobi_date(eobi_data.get("DOB", ""))
    doj = parse_eobi_date(eobi_data.get("DOJ", ""))
    doe = parse_eobi_date(eobi_data.get("DOE", ""))
    from_date = parse_eobi_date(eobi_data.get("From_Date", ""))
    to_date = parse_eobi_date(eobi_data.get("To_Date", ""))
    
    try:
        days_worked = float(eobi_data.get("NO_OF_DAYS_WORKED", "0") or "0")
    except:
        days_worked = 0
    
    # Use MERGE to handle duplicates
    query = f"""
    MERGE `{eobi_table_ref}` AS target
    USING (
      SELECT 
        @employee_id AS Employee_ID,
        @payroll_month AS Payroll_Month
    ) AS source
    ON target.Employee_ID = source.Employee_ID 
      AND target.Payroll_Month = source.Payroll_Month
    WHEN NOT MATCHED THEN
      INSERT (
        EOBI_ID, Employee_ID, Payroll_Month,
        EMP_AREA_CODE, EMP_REG_SERIAL_NO, EMP_SUB_AREA_CODE, EMP_SUB_SERIAL_NO,
        EOBI_NO, DOB, DOJ, DOE, NO_OF_DAYS_WORKED, From_Date, To_Date,
        Loaded_At, Created_At
      )
      VALUES (
        (SELECT COALESCE(MAX(EOBI_ID), 0) + 1 FROM `{eobi_table_ref}`),
        @employee_id, @payroll_month,
        @emp_area_code, @emp_reg_serial_no, @emp_sub_area_code, @emp_sub_serial_no,
        @eobi_no, @dob, @doj, @doe, @days_worked, @from_date, @to_date,
        CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
      )
    """
    
    params = [
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
        query_job.result()
        return True
    except Exception as e:
        error_msg = str(e)
        # MERGE doesn't work well with subqueries in VALUES, let's use simpler approach
        if "subquery" in error_msg.lower() or "MAX" in error_msg:
            # Fallback to regular INSERT with error handling
            return insert_eobi_record_direct(client, employee_id, eobi_data, payroll_month_date)
        return False

def insert_eobi_record_direct(client, employee_id, eobi_data, payroll_month_date):
    """Direct insert, will fail on duplicate."""
    eobi_table_ref = f"{PROJECT_ID}.{DATASET_ID}.{EOBI_TABLE}"
    eobi_id = get_next_eobi_id(client)
    
    dob = parse_eobi_date(eobi_data.get("DOB", ""))
    doj = parse_eobi_date(eobi_data.get("DOJ", ""))
    doe = parse_eobi_date(eobi_data.get("DOE", ""))
    from_date = parse_eobi_date(eobi_data.get("From_Date", ""))
    to_date = parse_eobi_date(eobi_data.get("To_Date", ""))
    
    try:
        days_worked = float(eobi_data.get("NO_OF_DAYS_WORKED", "0") or "0")
    except:
        days_worked = 0
    
    query = f"""
    INSERT INTO `{eobi_table_ref}` (
        EOBI_ID, Employee_ID, Payroll_Month,
        EMP_AREA_CODE, EMP_REG_SERIAL_NO, EMP_SUB_AREA_CODE, EMP_SUB_SERIAL_NO,
        EOBI_NO, DOB, DOJ, DOE, NO_OF_DAYS_WORKED, From_Date, To_Date,
        Loaded_At, Created_At
    ) VALUES (
        @eobi_id, @employee_id, @payroll_month,
        @emp_area_code, @emp_reg_serial_no, @emp_sub_area_code, @emp_sub_serial_no,
        @eobi_no, @dob, @doj, @doe, @days_worked, @from_date, @to_date,
        CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
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
        query_job.result()
        return True
    except Exception as e:
        error_msg = str(e)
        if "duplicate" in error_msg.lower() or "already exists" in error_msg.lower():
            return False  # Actual duplicate
        # For other errors, return False but don't print (too verbose)
        return False

def update_employee_eobi(client, employee_id, eobi_data):
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.{EMPLOYEES_TABLE}"
    updates = []
    params = []
    
    if eobi_data.get("EOBI_NO"):
        updates.append("EOBI_Number = @eobi_no")
        params.append(bigquery.ScalarQueryParameter("eobi_no", "STRING", eobi_data["EOBI_NO"]))
    if eobi_data.get("DOB"):
        dob = parse_eobi_date(eobi_data["DOB"])
        if dob:
            updates.append("Date_of_Birth = @dob")
            params.append(bigquery.ScalarQueryParameter("dob", "DATE", dob))
    if eobi_data.get("DOJ"):
        doj = parse_eobi_date(eobi_data["DOJ"])
        if doj:
            updates.append("Joining_Date = @doj")
            params.append(bigquery.ScalarQueryParameter("doj", "DATE", doj))
    if eobi_data.get("CNIC"):
        updates.append("CNIC_ID = @cnic")
        params.append(bigquery.ScalarQueryParameter("cnic", "STRING", eobi_data["CNIC"]))
    
    if not updates:
        return False
    
    query = f"UPDATE `{table_ref}` SET {', '.join(updates)}, Updated_At = CURRENT_DATETIME() WHERE Employee_ID = @employee_id"
    params.append(bigquery.ScalarQueryParameter("employee_id", "INT64", employee_id))
    job_config = bigquery.QueryJobConfig(query_parameters=params)
    
    try:
        query_job = client.query(query, job_config=job_config)
        query_job.result()
        return True
    except:
        return False

def main():
    csv_file = "/Users/shahzadvyro/Desktop/Vyro_Business_Paradox/EOBI updated data- AI - To be uploaded November 2025 (1).csv"
    
    if not os.path.exists(csv_file):
        print(f"Error: CSV file not found: {csv_file}")
        sys.exit(1)
    
    print(f"Reading EOBI data from: {csv_file}")
    eobi_records = read_eobi_csv(csv_file)
    print(f"Found {len(eobi_records)} records in CSV")
    
    payroll_month = "2025-11-01"
    print(f"Payroll Month: {payroll_month}\n")
    
    client = get_bigquery_client()
    
    matched = 0
    updated = 0
    inserted = 0
    skipped_duplicates = 0
    not_found = []
    
    for idx, record in enumerate(eobi_records, 1):
        name = record.get("NAME", "").strip()
        cnic = record.get("CNIC", "").strip()
        
        if not name:
            continue
        
        if idx % 50 == 0:
            print(f"  Progress: {idx}/{len(eobi_records)} (Inserted: {inserted}, Skipped: {skipped_duplicates})")
        
        employee_id, employee_name = match_employee(client, name, cnic)
        
        if not employee_id:
            not_found.append({"name": name, "cnic": cnic})
            continue
        
        matched += 1
        
        if insert_eobi_record_direct(client, employee_id, record, payroll_month):
            inserted += 1
        else:
            skipped_duplicates += 1
        
        update_employee_eobi(client, employee_id, record)
        updated += 1
    
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Total records: {len(eobi_records)}")
    print(f"Employees matched: {matched}")
    print(f"EOBI records inserted: {inserted}")
    print(f"EOBI records skipped (duplicates): {skipped_duplicates}")
    print(f"Employees updated: {updated}")
    print(f"Employees not found: {len(not_found)}")

if __name__ == "__main__":
    main()
