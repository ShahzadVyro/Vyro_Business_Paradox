#!/usr/bin/env python3
"""
Migrate Salary Data from CSV Files to Normalized Employee_Salaries Table
=========================================================================
Migrates data from Salaries Combined-USD.csv and Salaries Combined-PKR.csv 
to normalized Employee_Salaries fact table.

Prerequisites:
    - CSV files: Salaries Combined-USD.csv, Salaries Combined-PKR.csv
    - BigQuery Employee_Salaries table must exist
    - Employees table must exist (for Employee_ID validation)
    - Google Cloud credentials configured

Usage:
    python3 database/migrations/migrate_salary_data_from_csv.py

Author: AI Assistant
Date: January 2025
"""

import pandas as pd
import numpy as np
from datetime import datetime
import warnings
import os
import sys

warnings.filterwarnings('ignore')

try:
    from google.cloud import bigquery
    from pandas_gbq import to_gbq
except ImportError:
    print("ERROR: Required libraries not installed")
    print("Please run: pip install google-cloud-bigquery pandas-gbq pyarrow")
    sys.exit(1)

# Configuration
PROJECT_ID = "test-imagine-web"
DATASET_ID = "Vyro_Business_Paradox"
EMPLOYEES_TABLE = f"{PROJECT_ID}.{DATASET_ID}.Employees"
TARGET_TABLE = f"{PROJECT_ID}.{DATASET_ID}.Employee_Salaries"

USD_CSV = "Salaries Combined-USD.csv"
PKR_CSV = "Salaries Combined-PKR.csv"

# Set credentials path
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'Credentials/test-imagine-web-18d4f9a43aef.json'

def log(message):
    """Print timestamped log message"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def clean_numeric_string(value):
    """Clean numeric strings with commas and convert to float"""
    if pd.isna(value) or value == '' or value == '-':
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
        # Use 2025 as the year
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

def migrate_usd_csv():
    """Migrate USD salary data from CSV"""
    log(f"\nLoading USD CSV: {USD_CSV}...")
    
    if not os.path.exists(USD_CSV):
        log(f"❌ CSV file not found: {USD_CSV}")
        return None
    
    df = pd.read_csv(USD_CSV)
    log(f"Loaded {len(df)} rows from CSV")
    
    # Filter out header rows and invalid rows
    df = df[df['Month'].notna() & (df['Month'] != 'Month')]
    df = df[df['Employee ID'].notna()]
    df = df[df['Currency'].notna() & (df['Currency'] == 'USD')]
    
    log(f"After filtering: {len(df)} valid rows")
    
    salary_records = []
    
    for idx, row in df.iterrows():
        # Clean Employee_ID
        employee_id = clean_employee_id(row.get('Employee ID'))
        if employee_id is None:
            continue
        
        # Parse month to date
        payroll_month = parse_month_to_date(row.get('Month'))
        if payroll_month is None:
            continue
        
        # Create salary record
        record = {
            'Employee_ID': employee_id,
            'Payroll_Month': payroll_month,
            'Currency': 'USD',
            'Regular_Pay': clean_numeric_string(row.get('Regular Pay')),
            'Prorated_Pay': clean_numeric_string(row.get('Prorated Pay')),
            'Performance_Bonus': clean_numeric_string(row.get('Performance Bonus')),
            'Paid_Overtime': clean_numeric_string(row.get(' Paid Overtime ') or row.get('Paid Overtime')),
            'Reimbursements': clean_numeric_string(row.get('Reimbursements')),
            'Other': clean_numeric_string(row.get(' Other ') or row.get('Other')),
            'Gross_Income': clean_numeric_string(row.get('Gross Income')),
            'Unpaid_Leaves': clean_numeric_string(row.get('Unpaid Leaves')),
            'Deductions': clean_numeric_string(row.get('Deductions')),
            'Net_Income': clean_numeric_string(row.get(' Net Income ') or row.get('Net Income')),
            'Worked_Days': clean_numeric_string(row.get('Worked Days')),
            'Comments': str(row.get('Comments', '')) if pd.notna(row.get('Comments')) else None,
            'Internal_Comments': str(row.get('Internal comments', '')) if pd.notna(row.get('Internal comments')) else None,
            'Loaded_At': datetime.now(),
            'Created_At': datetime.now(),
        }
        
        # PKR-specific fields set to None for USD
        record.update({
            'Prorated_Base_Pay': None,
            'Prorated_Medical_Allowance': None,
            'Prorated_Transport_Allowance': None,
            'Prorated_Inflation_Allowance': None,
            'Taxable_Income': None,
            'Tax_Deduction': None,
            'EOBI': None,
            'Loan_Deduction': None,
            'Recoveries': None,
        })
        
        salary_records.append(record)
    
    df_salaries = pd.DataFrame(salary_records)
    log(f"Prepared {len(df_salaries)} USD salary records")
    
    return df_salaries

def migrate_pkr_csv():
    """Migrate PKR salary data from CSV"""
    log(f"\nLoading PKR CSV: {PKR_CSV}...")
    
    if not os.path.exists(PKR_CSV):
        log(f"❌ CSV file not found: {PKR_CSV}")
        return None
    
    df = pd.read_csv(PKR_CSV)
    log(f"Loaded {len(df)} rows from CSV")
    
    # Filter out header rows and invalid rows
    df = df[df['Month'].notna() & (df['Month'] != 'Month')]
    df = df[df['Employee ID'].notna()]
    df = df[df['Currency'].notna() & (df['Currency'] == 'PKR')]
    
    log(f"After filtering: {len(df)} valid rows")
    
    salary_records = []
    
    for idx, row in df.iterrows():
        # Clean Employee_ID
        employee_id = clean_employee_id(row.get('Employee ID'))
        if employee_id is None:
            continue
        
        # Parse month to date
        payroll_month = parse_month_to_date(row.get('Month'))
        if payroll_month is None:
            continue
        
        # Create salary record
        record = {
            'Employee_ID': employee_id,
            'Payroll_Month': payroll_month,
            'Currency': 'PKR',
            'Regular_Pay': clean_numeric_string(row.get('Regular Pay')),
            'Prorated_Pay': clean_numeric_string(row.get('Prorated Pay')),
            'Performance_Bonus': clean_numeric_string(row.get('Performance Bonus')),
            'Paid_Overtime': clean_numeric_string(row.get('Paid Overtime')),
            'Reimbursements': clean_numeric_string(row.get('Reimbursements')),
            'Other': clean_numeric_string(row.get('Other')),
            'Gross_Income': clean_numeric_string(row.get('Gross Income')),
            'Unpaid_Leaves': clean_numeric_string(row.get('Unpaid Leaves/days') or row.get('Unpaid Leaves')),
            'Deductions': clean_numeric_string(row.get('Deductions')),
            'Net_Income': clean_numeric_string(row.get('Net Income')),
            'Worked_Days': clean_numeric_string(row.get('Worked Days')),
            'Comments': str(row.get('Comments', '')) if pd.notna(row.get('Comments')) else None,
            'Internal_Comments': None,  # PKR CSV doesn't have Internal comments
            'Loaded_At': datetime.now(),
            'Created_At': datetime.now(),
            # PKR-specific fields
            'Prorated_Base_Pay': clean_numeric_string(row.get('Prorated Base Pay')),
            'Prorated_Medical_Allowance': clean_numeric_string(row.get('Prorated Medical Allowance')),
            'Prorated_Transport_Allowance': clean_numeric_string(row.get('Prorated Transport Allowance ')),
            'Prorated_Inflation_Allowance': clean_numeric_string(row.get('Prorated Inflation Allowance ')),
            'Taxable_Income': clean_numeric_string(row.get('Taxable Income')),
            'Tax_Deduction': clean_numeric_string(row.get('Tax deduction')),
            'EOBI': clean_numeric_string(row.get('EOBI')),
            'Loan_Deduction': clean_numeric_string(row.get('Loan deduction')),
            'Recoveries': clean_numeric_string(row.get('Recoveries ')),
        }
        
        salary_records.append(record)
    
    df_salaries = pd.DataFrame(salary_records)
    log(f"Prepared {len(df_salaries)} PKR salary records")
    
    return df_salaries

def verify_employee_ids(df_salaries):
    """Verify all Employee_IDs exist in Employees table"""
    log("\nVerifying Employee_IDs against Employees table...")
    
    client = bigquery.Client(project=PROJECT_ID)
    
    # Get all Employee_IDs from Employees table
    query = f"SELECT DISTINCT Employee_ID FROM `{EMPLOYEES_TABLE}` WHERE Employee_ID IS NOT NULL"
    df_employees = client.query(query).to_dataframe()
    valid_ids = set(df_employees['Employee_ID'].astype(int))
    
    # Check salary Employee_IDs
    salary_ids = set(df_salaries['Employee_ID'].astype(int))
    invalid_ids = salary_ids - valid_ids
    
    if len(invalid_ids) > 0:
        log(f"⚠️  WARNING: {len(invalid_ids)} Employee_IDs in salary data not found in Employees table")
        log(f"   Invalid IDs: {sorted(list(invalid_ids))[:20]}...")
        # Filter out invalid IDs
        df_salaries = df_salaries[df_salaries['Employee_ID'].isin(valid_ids)]
        log(f"   Filtered to {len(df_salaries)} valid records")
    else:
        log("✅ All Employee_IDs verified")
    
    return df_salaries

def main():
    """Main execution"""
    log("="*80)
    log("MIGRATE SALARY DATA FROM CSV FILES TO NORMALIZED TABLE")
    log("="*80)
    
    # Migrate USD salaries
    df_usd = migrate_usd_csv()
    
    # Migrate PKR salaries
    df_pkr = migrate_pkr_csv()
    
    # Combine
    if df_usd is not None and df_pkr is not None:
        df_all = pd.concat([df_usd, df_pkr], ignore_index=True)
    elif df_usd is not None:
        df_all = df_usd
    elif df_pkr is not None:
        df_all = df_pkr
    else:
        log("❌ No salary data to migrate")
        return
    
    log(f"\nTotal salary records: {len(df_all)}")
    
    # Remove duplicates (same Employee_ID + Payroll_Month + Currency)
    log("Checking for duplicates...")
    initial_count = len(df_all)
    df_all = df_all.drop_duplicates(subset=['Employee_ID', 'Payroll_Month', 'Currency'], keep='first')
    if len(df_all) < initial_count:
        log(f"   Removed {initial_count - len(df_all)} duplicate records")
    
    # Verify Employee_IDs
    df_all = verify_employee_ids(df_all)
    
    # Generate Salary_ID
    df_all['Salary_ID'] = range(1, len(df_all) + 1)
    
    # Load to BigQuery
    log(f"\nLoading {len(df_all)} salary records to {TARGET_TABLE}...")
    
    try:
        to_gbq(
            df_all,
            TARGET_TABLE,
            project_id=PROJECT_ID,
            if_exists='replace',
            progress_bar=True,
            chunksize=1000
        )
        
        log("✅ Salary data successfully migrated!")
        
        # Verify
        client = bigquery.Client(project=PROJECT_ID)
        table = client.get_table(TARGET_TABLE)
        log(f"✅ Verified: Table now has {table.num_rows} rows")
        
        # Show summary
        query = f"""
        SELECT Currency, COUNT(*) as count 
        FROM `{TARGET_TABLE}` 
        GROUP BY Currency
        ORDER BY Currency
        """
        df_summary = client.query(query).to_dataframe()
        log("\n" + "="*80)
        log("MIGRATION SUMMARY")
        log("="*80)
        for _, row in df_summary.iterrows():
            log(f"  {row['Currency']}: {row['count']} records")
        log(f"  TOTAL: {df_summary['count'].sum()} records")
        log("="*80)
        
    except Exception as e:
        log(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()


