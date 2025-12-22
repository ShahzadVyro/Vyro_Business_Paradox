#!/usr/bin/env python3
"""
Load Salary Data to BigQuery
============================
Loads USD and PKR salary CSV files into separate BigQuery tables.

Prerequisites:
    - BigQuery tables must exist (run create_salary_tables.sql first)
    - Google Cloud credentials configured
    - pandas and google-cloud-bigquery libraries installed

Usage:
    python3 load_salaries_to_bigquery.py

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
from typing import Optional

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
USD_TABLE_ID = "Combined-USD_2025"
PKR_TABLE_ID = "Combined-PKR_2025"

USD_TABLE_FULL = f"{PROJECT_ID}.{DATASET_ID}.{USD_TABLE_ID}"
PKR_TABLE_FULL = f"{PROJECT_ID}.{DATASET_ID}.{PKR_TABLE_ID}"

USD_CSV_PATH = "/Users/shahzadvyro/Desktop/Vyro_Business_Paradox/Salaries USD __ Master Tracker Paradox - Combined-USD 2025.csv"
PKR_CSV_PATH = "/Users/shahzadvyro/Desktop/Vyro_Business_Paradox/Salaries PKR __ Master Tracker Paradox - Combined-PKR 2025.csv"

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
    # Remove commas and spaces
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
        # Try common date formats
        for fmt in ['%d-%b-%y', '%d-%B-%y', '%d-%b-%Y', '%d-%B-%Y', '%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y']:
            try:
                return pd.to_datetime(value, format=fmt)
            except:
                continue
        # Fallback to pandas parser
        return pd.to_datetime(value, errors='coerce')
    except:
        return None

def clean_string(value):
    """Clean string values"""
    if pd.isna(value):
        return None
    value = str(value).strip()
    if value == '' or value.lower() == 'nan':
        return None
    return value

def load_usd_salaries():
    """Load USD salaries CSV file"""
    log("="*80)
    log("LOADING USD SALARIES")
    log("="*80)
    
    if not os.path.exists(USD_CSV_PATH):
        log(f"ERROR: USD CSV file not found: {USD_CSV_PATH}")
        return None
    
    log(f"Reading CSV file: {USD_CSV_PATH}")
    df = pd.read_csv(USD_CSV_PATH, low_memory=False)
    
    log(f"Loaded {len(df)} rows, {len(df.columns)} columns")
    
    # Remove total rows
    df = df[~df['Month Key'].astype(str).str.contains('total', case=False, na=False)]
    df = df[df['Employee ID'].notna()]
    
    log(f"After filtering: {len(df)} rows")
    
    # Clean and prepare data
    df_clean = pd.DataFrame()
    
    # Map columns to clean names and types
    column_mapping = {
        'Month Key': ('Month_Key', 'STRING'),
        'Key': ('Key', 'STRING'),
        'Status': ('Status', 'STRING'),
        'Employee ID': ('Employee_ID', 'STRING'),
        'Employee Name': ('Employee_Name', 'STRING'),
        'Designation': ('Designation', 'STRING'),
        'emails': ('Email', 'STRING'),
        'Date of Joining': ('Date_of_Joining', 'DATE'),
        'Date of Leaving': ('Date_of_Leaving', 'DATE'),
        'Worked Days': ('Worked_Days', 'NUMERIC'),
        'Dec Salary': ('Dec_Salary', 'NUMERIC'),
        'New Addition/Increment/Decrement': ('Increment_Decrement', 'NUMERIC'),
        'Date of Increment/ Decrement': ('Date_of_Increment', 'DATE'),
        'Payable from Last Month': ('Payable_from_Last_Month', 'NUMERIC'),
        'Regular Pay': ('Regular_Pay', 'NUMERIC'),
        'Prorated Pay': ('Prorated_Pay', 'NUMERIC'),
        'Performance Bonus': ('Performance_Bonus', 'NUMERIC'),
        ' Paid Overtime ': ('Paid_Overtime', 'NUMERIC'),
        'Reimbursements': ('Reimbursements', 'NUMERIC'),
        ' Other ': ('Other', 'NUMERIC'),
        'Gross Income': ('Gross_Income', 'NUMERIC'),
        'Unpaid Leaves': ('Unpaid_Leaves', 'NUMERIC'),
        'Deductions': ('Deductions', 'NUMERIC'),
        ' Net Income ': ('Net_Income', 'NUMERIC'),
        'Comments': ('Comments', 'STRING'),
        'Internal comments': ('Internal_Comments', 'STRING'),
        'Currency': ('Currency', 'STRING'),
        'Month': ('Month', 'STRING'),
    }
    
    for old_col, (new_col, dtype) in column_mapping.items():
        if old_col in df.columns:
            if dtype == 'STRING':
                df_clean[new_col] = df[old_col].apply(clean_string)
            elif dtype == 'DATE':
                df_clean[new_col] = df[old_col].apply(parse_date)
            elif dtype == 'NUMERIC':
                df_clean[new_col] = df[old_col].apply(clean_numeric_string)
        else:
            df_clean[new_col] = None
    
    # Add system fields
    df_clean['Loaded_At'] = datetime.now()
    
    log(f"Cleaned data: {len(df_clean)} rows")
    log(f"Columns: {list(df_clean.columns)}")
    
    return df_clean

def load_pkr_salaries():
    """Load PKR salaries CSV file"""
    log("="*80)
    log("LOADING PKR SALARIES")
    log("="*80)
    
    if not os.path.exists(PKR_CSV_PATH):
        log(f"ERROR: PKR CSV file not found: {PKR_CSV_PATH}")
        return None
    
    log(f"Reading CSV file: {PKR_CSV_PATH}")
    df = pd.read_csv(PKR_CSV_PATH, low_memory=False)
    
    log(f"Loaded {len(df)} rows, {len(df.columns)} columns")
    
    # Remove total rows
    df = df[~df['Month Key'].astype(str).str.contains('total', case=False, na=False)]
    df = df[df['Employee ID'].notna()]
    
    log(f"After filtering: {len(df)} rows")
    
    # Clean and prepare data
    df_clean = pd.DataFrame()
    
    # Map columns to clean names and types
    column_mapping = {
        'Month Key': ('Month_Key', 'STRING'),
        'Key': ('Key', 'STRING'),
        'Status': ('Status', 'STRING'),
        'Employee ID': ('Employee_ID', 'STRING'),
        'Employee Name': ('Employee_Name', 'STRING'),
        'Designation': ('Designation', 'STRING'),
        'Email address': ('Email', 'STRING'),
        'Date of Joining': ('Date_of_Joining', 'DATE'),
        'Date of Leaving': ('Date_of_Leaving', 'DATE'),
        'Worked Days': ('Worked_Days', 'NUMERIC'),
        "Last Months's Salary": ('Last_Months_Salary', 'NUMERIC'),
        ' Increment/ New Addition ': ('Increment_New_Addition', 'NUMERIC'),
        ' Date of Increment ': ('Date_of_Increment', 'DATE'),
        'Payable from Last/Next Month': ('Payable_from_Last_Next_Month', 'NUMERIC'),
        'Regular Pay': ('Regular_Pay', 'NUMERIC'),
        'Prorated Pay': ('Prorated_Pay', 'NUMERIC'),
        'Prorated Base Pay': ('Prorated_Base_Pay', 'NUMERIC'),
        'Prorated Medical Allowance': ('Prorated_Medical_Allowance', 'NUMERIC'),
        'Prorated Transport Allowance ': ('Prorated_Transport_Allowance', 'NUMERIC'),
        'Prorated Inflation Allowance ': ('Prorated_Inflation_Allowance', 'NUMERIC'),
        'Performance Bonus': ('Performance_Bonus', 'NUMERIC'),
        'Paid Overtime': ('Paid_Overtime', 'NUMERIC'),
        'Reimbursements': ('Reimbursements', 'NUMERIC'),
        'Other': ('Other', 'NUMERIC'),
        'Taxable Income': ('Taxable_Income', 'NUMERIC'),
        'Gross Income': ('Gross_Income', 'NUMERIC'),
        'Unpaid Leaves/days': ('Unpaid_Leaves', 'NUMERIC'),
        'Tax deduction': ('Tax_Deduction', 'NUMERIC'),
        'EOBI': ('EOBI', 'NUMERIC'),
        'Loan deduction': ('Loan_Deduction', 'NUMERIC'),
        'Recoveries ': ('Recoveries', 'NUMERIC'),
        'Deductions': ('Deductions', 'NUMERIC'),
        'Net Income': ('Net_Income', 'NUMERIC'),
        'Comments': ('Comments', 'STRING'),
        'Currency': ('Currency', 'STRING'),
        'Month': ('Month', 'STRING'),
    }
    
    for old_col, (new_col, dtype) in column_mapping.items():
        if old_col in df.columns:
            if dtype == 'STRING':
                df_clean[new_col] = df[old_col].apply(clean_string)
            elif dtype == 'DATE':
                df_clean[new_col] = df[old_col].apply(parse_date)
            elif dtype == 'NUMERIC':
                df_clean[new_col] = df[old_col].apply(clean_numeric_string)
        else:
            df_clean[new_col] = None
    
    # Add system fields
    df_clean['Loaded_At'] = datetime.now()
    
    log(f"Cleaned data: {len(df_clean)} rows")
    log(f"Columns: {list(df_clean.columns)}")
    
    return df_clean

def create_tables_if_not_exist():
    """Create BigQuery tables if they don't exist"""
    log("="*80)
    log("CHECKING/CREATING BIGQUERY TABLES")
    log("="*80)
    
    client = bigquery.Client(project=PROJECT_ID)
    
    # Check dataset exists
    try:
        dataset = client.get_dataset(DATASET_ID)
        log(f"✅ Dataset exists: {DATASET_ID}")
    except Exception as e:
        log(f"ERROR: Dataset not found: {DATASET_ID}")
        log(f"Please create the dataset first")
        return False
    
    # Check/create USD table
    try:
        table = client.get_table(USD_TABLE_FULL)
        log(f"✅ USD table exists: {USD_TABLE_ID}")
        log(f"   Current row count: {table.num_rows}")
    except Exception as e:
        log(f"⚠️  USD table not found, will be created automatically during load")
    
    # Check/create PKR table
    try:
        table = client.get_table(PKR_TABLE_FULL)
        log(f"✅ PKR table exists: {PKR_TABLE_ID}")
        log(f"   Current row count: {table.num_rows}")
    except Exception as e:
        log(f"⚠️  PKR table not found, will be created automatically during load")
    
    return True

def load_to_bigquery(df, table_id, table_name):
    """Load dataframe to BigQuery"""
    log("\n" + "="*80)
    log(f"LOADING {table_name} TO BIGQUERY")
    log("="*80)
    log(f"Target table: {table_id}")
    log(f"Rows to load: {len(df)}")
    
    try:
        log("Uploading data... (this may take a few minutes)")
        
        # Use pandas_gbq for easier data type handling
        to_gbq(
            df,
            table_id,
            project_id=PROJECT_ID,
            if_exists='replace',
            progress_bar=True,
            chunksize=1000
        )
        
        log(f"✅ {table_name} data successfully loaded to BigQuery!")
        
        # Verify the load
        client = bigquery.Client(project=PROJECT_ID)
        table = client.get_table(table_id)
        log(f"✅ Verified: Table now has {table.num_rows} rows")
        
        return True
        
    except Exception as e:
        log(f"❌ ERROR loading {table_name} to BigQuery: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main execution"""
    log("="*80)
    log("LOAD SALARY DATA TO BIGQUERY")
    log("="*80)
    
    # Step 1: Check prerequisites
    if not create_tables_if_not_exist():
        log("\n❌ Prerequisites not met. Exiting.")
        return
    
    # Step 2: Load USD salaries
    df_usd = load_usd_salaries()
    if df_usd is not None and len(df_usd) > 0:
        success_usd = load_to_bigquery(df_usd, USD_TABLE_FULL, "USD Salaries")
        if success_usd:
            log("✅ USD salaries loaded successfully!")
        else:
            log("❌ Failed to load USD salaries")
    else:
        log("⚠️  No USD salary data to load")
    
    # Step 3: Load PKR salaries
    df_pkr = load_pkr_salaries()
    if df_pkr is not None and len(df_pkr) > 0:
        success_pkr = load_to_bigquery(df_pkr, PKR_TABLE_FULL, "PKR Salaries")
        if success_pkr:
            log("✅ PKR salaries loaded successfully!")
        else:
            log("❌ Failed to load PKR salaries")
    else:
        log("⚠️  No PKR salary data to load")
    
    log("\n" + "="*80)
    log("✅ SALARY DATA LOAD COMPLETED!")
    log("="*80)
    log(f"\nTables created:")
    log(f"  1. {USD_TABLE_FULL}")
    log(f"  2. {PKR_TABLE_FULL}")
    log(f"\nNext Steps:")
    log(f"1. Verify data in BigQuery console")
    log(f"2. Create views or queries as needed")
    log(f"3. Set up appropriate access controls")
    log("="*80)

if __name__ == "__main__":
    main()







