#!/usr/bin/env python3
"""
Import Historical Salary Data from CSV Files to Employee_Salaries Table
========================================================================
Imports data from:
- Salaries Combined-USD.csv
- Salaries Combined-PKR.csv

This script maps all CSV columns to Employee_Salaries schema including:
- Month Key, Key, Status
- Email, Date of Joining, Date of Leaving
- Last Month Salary, Increment data
- All salary components and calculations
- PKR-specific fields (prorated allowances, tax, EOBI, etc.)

Prerequisites:
    - CSV files in project root directory
    - BigQuery Employee_Salaries table must exist
    - Employees table must exist (for Employee_ID validation)
    - Google Cloud credentials configured

Usage:
    python3 scripts/import_salary_csvs_to_bigquery.py

Author: AI Assistant
Date: January 2025
"""

import pandas as pd
import numpy as np
from datetime import datetime
import warnings
import os
import sys
import re

warnings.filterwarnings('ignore')

try:
    from google.cloud import bigquery
    from google.oauth2 import service_account
except ImportError:
    print("ERROR: Required libraries not installed")
    print("Please run: pip install google-cloud-bigquery pandas pyarrow")
    sys.exit(1)

# Configuration
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "test-imagine-web")
DATASET_ID = os.getenv("BQ_DATASET", "Vyro_Business_Paradox")
EMPLOYEES_TABLE = f"{PROJECT_ID}.{DATASET_ID}.Employees"
TARGET_TABLE = f"{PROJECT_ID}.{DATASET_ID}.Employee_Salaries"

# CSV file paths (relative to script location)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
USD_CSV = os.path.join(PROJECT_ROOT, "Salaries Combined-USD.csv")
PKR_CSV = os.path.join(PROJECT_ROOT, "Salaries Combined-PKR.csv")

# Set credentials path
CREDENTIALS_PATH = os.getenv(
    "GOOGLE_APPLICATION_CREDENTIALS",
    os.path.join(PROJECT_ROOT, "Credentials", "test-imagine-web-18d4f9a43aef.json")
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

def log(message):
    """Print timestamped log message"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def clean_numeric_string(value):
    """Clean numeric strings with commas and convert to float"""
    if pd.isna(value) or value == '' or value == '-' or str(value).strip() == '':
        return None
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = str(value).replace(',', '').replace(' ', '').strip()
    if cleaned == '' or cleaned == '-' or cleaned.lower() == 'nan':
        return None
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None

def parse_date(value):
    """Parse various date formats from CSV"""
    if pd.isna(value) or value == '' or str(value).strip() == '':
        return None
    
    value_str = str(value).strip()
    
    # Try parsing common formats
    formats = [
        '%d-%b-%y',  # 25-Sep-23
        '%d-%b-%Y',  # 25-Sep-2023
        '%Y-%m-%d',  # 2023-09-25
        '%d/%m/%Y',  # 25/09/2023
        '%m/%d/%Y',  # 09/25/2023
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(value_str, fmt).date()
        except ValueError:
            continue
    
    # Try parsing "1 Jan" format
    try:
        day, month = value_str.split()
        month_map = {
            'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
            'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
        }
        if month.lower() in month_map:
            return datetime(2025, month_map[month.lower()], int(day)).date()
    except:
        pass
    
    return None

def parse_month_to_date(month_str):
    """Convert month string (Jan, Feb, etc.) to first day of month date"""
    if pd.isna(month_str) or month_str == '' or month_str == 'Month':
        return None
    
    month_map = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6, 'june': 6,
        'jul': 7, 'july': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    }
    
    month_lower = str(month_str).lower().strip()
    if month_lower in month_map:
        year = 2025
        return datetime(year, month_map[month_lower], 1).date()
    
    return None

def clean_employee_id(value):
    """Clean and convert to numeric Employee_ID"""
    if pd.isna(value) or value == '':
        return None
    if isinstance(value, (int, float)):
        return int(value)
    try:
        return int(float(str(value).replace(',', '').strip()))
    except (ValueError, TypeError):
        return None

def import_usd_csv(client):
    """Import USD salary data from CSV"""
    log(f"\nLoading USD CSV: {USD_CSV}...")
    
    if not os.path.exists(USD_CSV):
        log(f"ERROR: USD CSV file not found: {USD_CSV}")
        return []
    
    df = pd.read_csv(USD_CSV)
    log(f"Loaded {len(df)} rows from USD CSV")
    
    records = []
    max_salary_id = 0
    
    # Get max Salary_ID from existing data
    try:
        query = f"SELECT MAX(Salary_ID) as max_id FROM `{TARGET_TABLE}`"
        result = client.query(query).result()
        for row in result:
            max_salary_id = row.max_id or 0
    except Exception as e:
        log(f"Could not get max Salary_ID: {e}")
    
    salary_id_counter = max_salary_id + 1
    
    for idx, row in df.iterrows():
        try:
            employee_id = clean_employee_id(row.get('Employee ID'))
            if not employee_id:
                continue
            
            month_str = row.get('Month', '')
            payroll_month = parse_month_to_date(month_str)
            if not payroll_month:
                continue
            
            # Parse dates
            joining_date = parse_date(row.get('Date of Joining'))
            leaving_date = parse_date(row.get('Date of Leaving'))
            increment_date = parse_date(row.get('Date of Increment/ Decrement'))
            
            # Parse numeric values
            regular_pay = clean_numeric_string(row.get('Regular Pay'))
            prorated_pay = clean_numeric_string(row.get('Prorated Pay'))
            performance_bonus = clean_numeric_string(row.get('Performance Bonus'))
            paid_overtime = clean_numeric_string(row.get(' Paid Overtime '))
            reimbursements = clean_numeric_string(row.get('Reimbursements'))
            other = clean_numeric_string(row.get(' Other '))
            gross_income = clean_numeric_string(row.get('Gross Income'))
            unpaid_leaves = clean_numeric_string(row.get('Unpaid Leaves'))
            deductions = clean_numeric_string(row.get('Deductions'))
            net_income = clean_numeric_string(row.get(' Net Income '))
            worked_days = clean_numeric_string(row.get('Worked Days'))
            last_month_salary = clean_numeric_string(row.get('Dec Salary'))
            increment_amount = clean_numeric_string(row.get('New Addition/Increment/Decrement'))
            payable_from_last = clean_numeric_string(row.get('Payable from Last Month'))
            
            # Calculate Revised_with_OPD (Regular Pay + 21 for USD, if not in probation)
            # We'll need to check probation status, but for now use Regular Pay
            revised_with_opd = regular_pay  # Will be calculated properly later
            
            record = {
                'Salary_ID': salary_id_counter,
                'Employee_ID': employee_id,
                'Payroll_Month': payroll_month,
                'Currency': 'USD',
                'Month_Key': str(row.get('Month Key', '')),
                'Key': str(row.get('Key', '')),
                'Status': str(row.get('Status', '')),
                'Email': str(row.get('emails', '')),
                'Date_of_Joining': joining_date,
                'Date_of_Leaving': leaving_date,
                'Worked_Days': worked_days,
                'Last_Month_Salary': last_month_salary,
                'New_Addition_Increment_Decrement': increment_amount,
                'Date_of_Increment_Decrement': increment_date,
                'Payable_from_Last_Month': payable_from_last,
                'Regular_Pay': regular_pay,
                'Revised_with_OPD': revised_with_opd,
                'Prorated_Pay': prorated_pay,
                'Performance_Bonus': performance_bonus,
                'Paid_Overtime': paid_overtime,
                'Reimbursements': reimbursements,
                'Other': other,
                'Gross_Income': gross_income,
                'Unpaid_Leaves': unpaid_leaves,
                'Deductions': deductions,
                'Net_Income': net_income,
                'Comments': str(row.get('Comments', '')) if pd.notna(row.get('Comments')) else None,
                'Internal_Comments': str(row.get('Internal comments', '')) if pd.notna(row.get('Internal comments')) else None,
                'Designation_At_Payroll': str(row.get('Designation', '')) if pd.notna(row.get('Designation')) else None,
                'Month': month_str,
                'Salary_Status': 'Released' if str(row.get('Status', '')) == '1' else 'HOLD',
                'PaySlip_Status': 'Not Sent',  # Default
                'Created_At': datetime.now(),
            }
            
            records.append(record)
            salary_id_counter += 1
            
        except Exception as e:
            log(f"Error processing USD row {idx}: {e}")
            continue
    
    log(f"Processed {len(records)} USD records")
    return records

def import_pkr_csv(client):
    """Import PKR salary data from CSV"""
    log(f"\nLoading PKR CSV: {PKR_CSV}...")
    
    if not os.path.exists(PKR_CSV):
        log(f"ERROR: PKR CSV file not found: {PKR_CSV}")
        return []
    
    df = pd.read_csv(PKR_CSV)
    log(f"Loaded {len(df)} rows from PKR CSV")
    
    records = []
    max_salary_id = 0
    
    # Get max Salary_ID from existing data
    try:
        query = f"SELECT MAX(Salary_ID) as max_id FROM `{TARGET_TABLE}`"
        result = client.query(query).result()
        for row in result:
            max_salary_id = row.max_id or 0
    except Exception as e:
        log(f"Could not get max Salary_ID: {e}")
    
    salary_id_counter = max_salary_id + 1
    
    for idx, row in df.iterrows():
        try:
            employee_id = clean_employee_id(row.get('Employee ID'))
            if not employee_id:
                continue
            
            month_str = row.get('Month', '')
            payroll_month = parse_month_to_date(month_str)
            if not payroll_month:
                continue
            
            # Parse dates
            joining_date = parse_date(row.get('Date of Joining'))
            leaving_date = parse_date(row.get('Date of Leaving'))
            increment_date = parse_date(row.get(' Date of Increment '))
            
            # Parse numeric values
            regular_pay = clean_numeric_string(row.get('Regular Pay'))
            prorated_pay = clean_numeric_string(row.get('Prorated Pay'))
            prorated_base_pay = clean_numeric_string(row.get('Prorated Base Pay'))
            prorated_medical = clean_numeric_string(row.get('Prorated Medical Allowance'))
            prorated_transport = clean_numeric_string(row.get('Prorated Transport Allowance '))
            prorated_inflation = clean_numeric_string(row.get('Prorated Inflation Allowance '))
            performance_bonus = clean_numeric_string(row.get('Performance Bonus'))
            paid_overtime = clean_numeric_string(row.get('Paid Overtime'))
            reimbursements = clean_numeric_string(row.get('Reimbursements'))
            other = clean_numeric_string(row.get('Other'))
            taxable_income = clean_numeric_string(row.get('Taxable Income'))
            gross_income = clean_numeric_string(row.get('Gross Income'))
            unpaid_leaves = clean_numeric_string(row.get('Unpaid Leaves/days'))
            tax_deduction = clean_numeric_string(row.get('Tax deduction'))
            eobi = clean_numeric_string(row.get('EOBI'))
            loan_deduction = clean_numeric_string(row.get('Loan deduction'))
            recoveries = clean_numeric_string(row.get('Recoveries '))
            deductions = clean_numeric_string(row.get('Deductions'))
            net_income = clean_numeric_string(row.get('Net Income'))
            worked_days = clean_numeric_string(row.get('Worked Days'))
            last_month_salary = clean_numeric_string(row.get("Last Months's Salary"))
            increment_amount = clean_numeric_string(row.get(' Increment/ New Addition '))
            payable_from_last = clean_numeric_string(row.get('Payable from Last/Next Month'))
            
            record = {
                'Salary_ID': salary_id_counter,
                'Employee_ID': employee_id,
                'Payroll_Month': payroll_month,
                'Currency': 'PKR',
                'Month_Key': str(row.get('Month Key', '')),
                'Key': str(row.get('Key', '')),
                'Status': str(row.get('Status', '')),
                'Email': str(row.get('Email address', '')),
                'Date_of_Joining': joining_date,
                'Date_of_Leaving': leaving_date,
                'Worked_Days': worked_days,
                'Last_Month_Salary': last_month_salary,
                'New_Addition_Increment_Decrement': increment_amount,
                'Date_of_Increment_Decrement': increment_date,
                'Payable_from_Last_Month': payable_from_last,
                'Regular_Pay': regular_pay,
                'Prorated_Pay': prorated_pay,
                'Prorated_Base_Pay': prorated_base_pay,
                'Prorated_Medical_Allowance': prorated_medical,
                'Prorated_Transport_Allowance': prorated_transport,
                'Prorated_Inflation_Allowance': prorated_inflation,
                'Performance_Bonus': performance_bonus,
                'Paid_Overtime': paid_overtime,
                'Reimbursements': reimbursements,
                'Other': other,
                'Taxable_Income': taxable_income,
                'Gross_Income': gross_income,
                'Unpaid_Leaves': unpaid_leaves,
                'Tax_Deduction': tax_deduction,
                'EOBI': eobi,
                'Loan_Deduction': loan_deduction,
                'Recoveries': recoveries,
                'Deductions': deductions,
                'Net_Income': net_income,
                'Comments': str(row.get('Comments', '')) if pd.notna(row.get('Comments')) else None,
                'Internal_Comments': None,  # PKR CSV doesn't have this
                'Designation_At_Payroll': str(row.get('Designation', '')) if pd.notna(row.get('Designation')) else None,
                'Month': month_str,
                'Salary_Status': 'Released' if str(row.get('Status', '')) == '1' else 'HOLD',
                'PaySlip_Status': 'Not Sent',  # Default
                'Created_At': datetime.now(),
            }
            
            records.append(record)
            salary_id_counter += 1
            
        except Exception as e:
            log(f"Error processing PKR row {idx}: {e}")
            continue
    
    log(f"Processed {len(records)} PKR records")
    return records

def insert_records(client, records):
    """Insert records into BigQuery"""
    if not records:
        log("No records to insert")
        return 0
    
    log(f"\nInserting {len(records)} records into {TARGET_TABLE}...")
    
    # Convert to DataFrame
    df = pd.DataFrame(records)
    
    # Remove duplicates based on Employee_ID + Payroll_Month + Currency
    df = df.drop_duplicates(subset=['Employee_ID', 'Payroll_Month', 'Currency'], keep='first')
    log(f"After deduplication: {len(df)} records")
    
    # Insert into BigQuery
    try:
        job_config = bigquery.LoadJobConfig(
            write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
            schema_update_options=[bigquery.SchemaUpdateOption.ALLOW_FIELD_ADDITION],
        )
        
        job = client.load_table_from_dataframe(df, TARGET_TABLE, job_config=job_config)
        job.result()  # Wait for job to complete
        
        log(f"✓ Successfully inserted {len(df)} records")
        return len(df)
    except Exception as e:
        log(f"✗ Error inserting records: {e}")
        return 0

def main():
    """Main execution function"""
    log("=" * 60)
    log("Salary CSV Import Script")
    log("=" * 60)
    
    client = get_bigquery_client()
    
    # Import USD data
    usd_records = import_usd_csv(client)
    
    # Import PKR data
    pkr_records = import_pkr_csv(client)
    
    # Combine and insert
    all_records = usd_records + pkr_records
    log(f"\nTotal records to insert: {len(all_records)}")
    
    if all_records:
        inserted = insert_records(client, all_records)
        log(f"\n✓ Import complete: {inserted} records inserted")
    else:
        log("\n✗ No records to import")
    
    log("=" * 60)

if __name__ == "__main__":
    main()
