#!/usr/bin/env python3
"""
Migrate Salary Data to Normalized Employee_Salaries Table
==========================================================
Migrates data from Combined-USD_2025 and Combined-PKR_2025 to normalized Employee_Salaries fact table.
Maps Employee_IDs and removes denormalized employee data.

Prerequisites:
    - BigQuery Employee_Salaries table must exist
    - Employees table must exist (for Employee_ID mapping)
    - Google Cloud credentials configured

Usage:
    python3 database/migrations/migrate_salary_data.py

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
USD_TABLE = f"{PROJECT_ID}.{DATASET_ID}.Combined-USD_2025"
PKR_TABLE = f"{PROJECT_ID}.{DATASET_ID}.Combined-PKR_2025"
EMPLOYEES_TABLE = f"{PROJECT_ID}.{DATASET_ID}.Employees"
TARGET_TABLE = f"{PROJECT_ID}.{DATASET_ID}.Employee_Salaries"

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

def parse_date(value):
    """Parse date string to datetime"""
    if pd.isna(value) or value == '':
        return None
    if isinstance(value, datetime):
        return value
    try:
        for fmt in ['%d-%b-%y', '%d-%B-%y', '%d-%b-%Y', '%d-%B-%Y', '%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y']:
            try:
                return pd.to_datetime(value, format=fmt)
            except:
                continue
        return pd.to_datetime(value, errors='coerce')
    except:
        return None

def parse_month_to_date(month_str):
    """Convert month string (Jan, Feb, etc.) to first day of month date"""
    if pd.isna(month_str) or month_str == '':
        return None
    
    month_map = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6, 'june': 6,
        'jul': 7, 'july': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
    }
    
    month_lower = str(month_str).lower().strip()
    if month_lower in month_map:
        # Use current year, or 2025 if specified
        year = 2025
        return datetime(year, month_map[month_lower], 1).date()
    
    return None

def clean_numeric_id(value):
    """Clean and convert to numeric ID"""
    if pd.isna(value) or value == '':
        return None
    if isinstance(value, (int, float)):
        return int(value)
    try:
        return int(float(str(value).replace(',', '').strip()))
    except (ValueError, TypeError):
        return None

def migrate_salary_table(table_id, currency):
    """Migrate salary data from source table"""
    log(f"\nMigrating {currency} salary data from {table_id}...")
    
    client = bigquery.Client(project=PROJECT_ID)
    
    try:
        query = f"SELECT * FROM `{table_id}` WHERE Employee_ID IS NOT NULL AND Month IS NOT NULL AND Month != 'Month'"
        df = client.query(query).to_dataframe()
        log(f"Loaded {len(df)} rows")
    except Exception as e:
        log(f"⚠️  Could not load from {table_id}: {e}")
        return None
    
    if len(df) == 0:
        log(f"No data to migrate from {table_id}")
        return None
    
    # Clean Employee_ID
    df['Employee_ID'] = df['Employee_ID'].apply(clean_numeric_id)
    df = df[df['Employee_ID'].notna()]
    
    # Prepare salary records
    salary_records = []
    
    for idx, row in df.iterrows():
        # Parse month to date
        payroll_month = parse_month_to_date(row.get('Month'))
        if payroll_month is None:
            continue
        
        # Create salary record
        record = {
            'Employee_ID': int(row['Employee_ID']),
            'Payroll_Month': payroll_month,
            'Currency': currency,
            'Regular_Pay': clean_numeric_string(row.get('Regular Pay')),
            'Prorated_Pay': clean_numeric_string(row.get('Prorated Pay')),
            'Performance_Bonus': clean_numeric_string(row.get('Performance Bonus')),
            'Paid_Overtime': clean_numeric_string(row.get('Paid Overtime') or row.get(' Paid Overtime ')),
            'Reimbursements': clean_numeric_string(row.get('Reimbursements')),
            'Other': clean_numeric_string(row.get('Other') or row.get(' Other ')),
            'Gross_Income': clean_numeric_string(row.get('Gross Income')),
            'Unpaid_Leaves': clean_numeric_string(row.get('Unpaid Leaves') or row.get('Unpaid Leaves/days')),
            'Deductions': clean_numeric_string(row.get('Deductions')),
            'Net_Income': clean_numeric_string(row.get('Net Income') or row.get('Net Income')),
            'Worked_Days': clean_numeric_string(row.get('Worked Days')),
            'Comments': str(row.get('Comments', '')) if pd.notna(row.get('Comments')) else None,
            'Internal_Comments': str(row.get('Internal comments', '')) if pd.notna(row.get('Internal comments')) else None,
            'Loaded_At': datetime.now(),
            'Created_At': datetime.now(),
        }
        
        # PKR-specific fields
        if currency == 'PKR':
            record.update({
                'Prorated_Base_Pay': clean_numeric_string(row.get('Prorated Base Pay')),
                'Prorated_Medical_Allowance': clean_numeric_string(row.get('Prorated Medical Allowance')),
                'Prorated_Transport_Allowance': clean_numeric_string(row.get('Prorated Transport Allowance ')),
                'Prorated_Inflation_Allowance': clean_numeric_string(row.get('Prorated Inflation Allowance ')),
                'Taxable_Income': clean_numeric_string(row.get('Taxable Income')),
                'Tax_Deduction': clean_numeric_string(row.get('Tax deduction')),
                'EOBI': clean_numeric_string(row.get('EOBI')),
                'Loan_Deduction': clean_numeric_string(row.get('Loan deduction')),
                'Recoveries': clean_numeric_string(row.get('Recoveries ')),
            })
        
        salary_records.append(record)
    
    df_salaries = pd.DataFrame(salary_records)
    
    # Add Salary_ID
    df_salaries['Salary_ID'] = range(1, len(df_salaries) + 1)
    
    log(f"Prepared {len(df_salaries)} salary records")
    
    return df_salaries

def verify_employee_ids(df_salaries):
    """Verify all Employee_IDs exist in Employees table"""
    log("Verifying Employee_IDs against Employees table...")
    
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
        log(f"   Invalid IDs: {sorted(list(invalid_ids))[:10]}...")
        # Filter out invalid IDs
        df_salaries = df_salaries[df_salaries['Employee_ID'].isin(valid_ids)]
        log(f"   Filtered to {len(df_salaries)} valid records")
    else:
        log("✅ All Employee_IDs verified")
    
    return df_salaries

def main():
    """Main execution"""
    log("="*80)
    log("MIGRATE SALARY DATA TO NORMALIZED TABLE")
    log("="*80)
    
    # Migrate USD salaries
    df_usd = migrate_salary_table(USD_TABLE, 'USD')
    
    # Migrate PKR salaries
    df_pkr = migrate_salary_table(PKR_TABLE, 'PKR')
    
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
    
    # Verify Employee_IDs
    df_all = verify_employee_ids(df_all)
    
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
        
    except Exception as e:
        log(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()


