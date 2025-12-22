#!/usr/bin/env python3
"""
Load Directory Employees Data to BigQuery
==========================================
Loads Directory Employees Data CSV file into BigQuery table.

Prerequisites:
    - BigQuery table must exist (run create_directory_employees_table.sql first)
    - Google Cloud credentials configured
    - pandas and google-cloud-bigquery libraries installed

Usage:
    python3 load_directory_employees_to_bigquery.py

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
    from pandas_gbq import to_gbq
except ImportError:
    print("ERROR: Required libraries not installed")
    print("Please run: pip install google-cloud-bigquery pandas-gbq pyarrow")
    sys.exit(1)

# Configuration
PROJECT_ID = "test-imagine-web"
DATASET_ID = "Vyro_Business_Paradox"
TABLE_ID = "Directory_Employees_Data"
TABLE_FULL = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"

CSV_PATH = "/Users/shahzadvyro/Desktop/Vyro_Business_Paradox/Directory_Employees_Data.csv"

# Set credentials path
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'Credentials/test-imagine-web-18d4f9a43aef.json'

def log(message):
    """Print timestamped log message"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def parse_date(value):
    """Parse date string to datetime"""
    if pd.isna(value) or value == '':
        return None
    if isinstance(value, datetime):
        return value
    try:
        # Try common date formats
        for fmt in ['%d-%b-%y', '%d-%B-%y', '%d-%b-%Y', '%d-%B-%Y', '%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%d-%m-%Y']:
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

def load_directory_employees():
    """Load Directory Employees CSV file"""
    log("="*80)
    log("LOADING DIRECTORY EMPLOYEES DATA")
    log("="*80)
    
    if not os.path.exists(CSV_PATH):
        log(f"ERROR: CSV file not found: {CSV_PATH}")
        return None
    
    log(f"Reading CSV file: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH, low_memory=False)
    
    log(f"Loaded {len(df)} rows, {len(df.columns)} columns")
    
    # Check for duplicate Status column (pandas may rename it to Status.1)
    if 'Status.1' in df.columns:
        log(f"⚠️  Found duplicate Status column (Status.1), renaming to Status_Duplicate")
        df = df.rename(columns={'Status.1': 'Status_Duplicate'})
    elif len([col for col in df.columns if col == 'Status']) > 1:
        # If there are multiple Status columns with same name, rename the last one
        status_cols = [i for i, col in enumerate(df.columns) if col == 'Status']
        if len(status_cols) > 1:
            df.columns.values[status_cols[-1]] = 'Status_Duplicate'
            log(f"Renamed duplicate Status column to 'Status_Duplicate'")
    
    # Remove rows without ID
    df = df[df['ID'].notna()]
    df = df[~df['ID'].astype(str).str.strip().eq('')]
    df['ID'] = df['ID'].astype(str).str.split('.').str[0].astype(int)
    
    log(f"After filtering: {len(df)} rows")
    
    # Clean and prepare data
    df_clean = pd.DataFrame()
    
    # Map columns to clean names and types
    column_mapping = {
        'ID': ('ID', 'INT'),
        'Name': ('Name', 'STRING'),
        'Personal Email': ('Personal_Email', 'STRING'),
        'Official Email': ('Official_Email', 'STRING'),
        'Joining Date': ('Joining_Date', 'DATE'),
        'Designation': ('Designation', 'STRING'),
        'Department': ('Department', 'STRING'),
        'Reporting Manager': ('Reporting_Manager', 'STRING'),
        'Job Type': ('Job_Type', 'STRING'),
        'Status': ('Status', 'STRING'),
        'Probation Period': ('Probation_Period', 'STRING'),
        'Probation End Date': ('Probation_End_Date', 'DATE'),
        'Contact Number': ('Contact_Number', 'STRING'),
        'CNIC / ID': ('CNIC_ID', 'STRING'),
        'Gender': ('Gender', 'STRING'),
        'Bank Name': ('Bank_Name', 'STRING'),
        'Bank Account Title': ('Bank_Account_Title', 'STRING'),
        'Bank Account Number-IBAN (24 digits)': ('Bank_Account_Number_IBAN', 'STRING'),
        'Swift Code/ BIC Code': ('Swift_Code_BIC', 'STRING'),
        'Routing Number': ('Routing_Number', 'STRING'),
        'Employment Location': ('Employment_Location', 'STRING'),
        'Date of Birth': ('Date_of_Birth', 'DATE'),
        'Age': ('Age', 'STRING'),
        'Address': ('Address', 'STRING'),
        'Nationality': ('Nationality', 'STRING'),
        'Marital Status': ('Marital_Status', 'STRING'),
        "Father's Name": ('Fathers_Name', 'STRING'),
        "Emergency Contact's Relationship": ('Emergency_Contact_Relationship', 'STRING'),
        'Emergency Contact Number': ('Emergency_Contact_Number', 'STRING'),
        'Blood Group': ('Blood_Group', 'STRING'),
        'LinkedIn URL': ('LinkedIn_URL', 'STRING'),
        'Recruiter Name': ('Recruiter_Name', 'STRING'),
        'Employment End Date': ('Employment_End_Date', 'DATE'),
        'Group Name': ('Group_Name', 'STRING'),
        'Group Email': ('Group_Email', 'STRING'),
        'Re-Joined': ('Re_Joined', 'STRING'),
        'Status_Duplicate': ('Status_Duplicate', 'STRING'),  # Handle duplicate Status column
        'Key': ('Key', 'STRING'),
    }
    
    for old_col, (new_col, dtype) in column_mapping.items():
        if old_col in df.columns:
            if dtype == 'STRING':
                df_clean[new_col] = df[old_col].apply(clean_string)
            elif dtype == 'DATE':
                parsed_series = df[old_col].apply(parse_date)
                df_clean[new_col] = pd.to_datetime(parsed_series).dt.date
            elif dtype == 'INT':
                df_clean[new_col] = pd.to_numeric(df[old_col], errors='coerce').astype('Int64')
        else:
            # Column not found, set to None
            df_clean[new_col] = None
    
    # Add system fields
    df_clean['Loaded_At'] = datetime.now()
    
    log(f"Cleaned data: {len(df_clean)} rows")
    log(f"Columns: {len(df_clean.columns)}")
    
    # Show sample of data
    log(f"\nSample data (first 3 rows):")
    log(f"Columns: {list(df_clean.columns[:5])}...")
    
    return df_clean

def create_table_if_not_exist():
    """Create BigQuery table if it doesn't exist"""
    log("="*80)
    log("CHECKING/CREATING BIGQUERY TABLE")
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
    
    # Check/create table
    try:
        table = client.get_table(TABLE_FULL)
        log(f"✅ Table exists: {TABLE_ID}")
        log(f"   Current row count: {table.num_rows}")
    except Exception as e:
        log(f"⚠️  Table not found, will be created automatically during load")
    
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
    log("LOAD DIRECTORY EMPLOYEES DATA TO BIGQUERY")
    log("="*80)
    
    # Step 1: Check prerequisites
    if not create_table_if_not_exist():
        log("\n❌ Prerequisites not met. Exiting.")
        return
    
    # Step 2: Load directory employees data
    df = load_directory_employees()
    if df is not None and len(df) > 0:
        success = load_to_bigquery(df, TABLE_FULL, "Directory Employees Data")
        if success:
            log("✅ Directory employees data loaded successfully!")
        else:
            log("❌ Failed to load directory employees data")
    else:
        log("⚠️  No directory employees data to load")
    
    log("\n" + "="*80)
    log("✅ DIRECTORY EMPLOYEES DATA LOAD COMPLETED!")
    log("="*80)
    log(f"\nTable created: {TABLE_FULL}")
    log(f"\nNext Steps:")
    log(f"1. Verify data in BigQuery console")
    log(f"2. Create views or queries as needed")
    log(f"3. Set up appropriate access controls")
    log("="*80)

if __name__ == "__main__":
    main()

