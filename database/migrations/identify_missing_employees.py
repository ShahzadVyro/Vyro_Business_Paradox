#!/usr/bin/env python3
"""
Identify and Add Missing Employees from CSV Files
==================================================
Compares CSV files with the unified Employees table to find missing employees
and adds them to Directory_Employees_Data, then re-runs migration.

Usage:
    python3 database/migrations/identify_missing_employees.py
"""

import pandas as pd
from google.cloud import bigquery
from pandas_gbq import to_gbq
import os
from datetime import datetime
import warnings

warnings.filterwarnings('ignore')

PROJECT_ID = "test-imagine-web"
DATASET_ID = "Vyro_Business_Paradox"
EMPLOYEES_TABLE = f"{PROJECT_ID}.{DATASET_ID}.Employees"
DIRECTORY_TABLE = f"{PROJECT_ID}.{DATASET_ID}.Directory_Employees_Data"

os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'Credentials/test-imagine-web-18d4f9a43aef.json'

def log(message):
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

def get_existing_employee_ids():
    """Get existing Employee_IDs from unified Employees table"""
    client = bigquery.Client(project=PROJECT_ID)
    query = f"SELECT DISTINCT Employee_ID FROM `{EMPLOYEES_TABLE}` WHERE Employee_ID IS NOT NULL"
    df = client.query(query).to_dataframe()
    return set(df['Employee_ID'].dropna().astype(int).tolist())

def extract_missing_employees():
    """Extract missing employees from CSV files compared to Employees table"""
    # Load CSV files
    df_active = pd.read_csv('Active Employees.csv')
    df_resigned = pd.read_csv('Resigned:Terminated Employees.csv')
    
    # Filter valid rows
    df_active_clean = df_active[(df_active['ID'].notna()) & (df_active['Name'].notna())]
    df_resigned_clean = df_resigned[(df_resigned['ID'].notna()) & (df_resigned['Name'].notna())]
    
    # Get existing IDs from Employees table
    existing_ids = get_existing_employee_ids()
    log(f"Found {len(existing_ids)} existing Employee_IDs in Employees table")
    
    # Find missing employees
    missing_active = df_active_clean[~df_active_clean['ID'].astype(int).isin(existing_ids)]
    missing_resigned = df_resigned_clean[~df_resigned_clean['ID'].astype(int).isin(existing_ids)]
    
    log(f"Missing Active employees: {len(missing_active)}")
    log(f"Missing Resigned/Terminated employees: {len(missing_resigned)}")
    
    if len(missing_active) > 0:
        log(f"\nMissing Active Employee IDs: {sorted(missing_active['ID'].astype(int).unique().tolist())}")
    if len(missing_resigned) > 0:
        log(f"\nMissing Resigned/Terminated Employee IDs: {sorted(missing_resigned['ID'].astype(int).unique().tolist())}")
    
    # Combine and prepare for BigQuery
    missing_all = pd.concat([missing_active, missing_resigned], ignore_index=True)
    
    return missing_all

def map_to_directory_schema(df):
    """Map CSV columns to Directory_Employees_Data schema"""
    # BigQuery doesn't allow spaces/special chars in column names
    # Map CSV column names to match Directory_Employees_Data table schema exactly
    column_mapping = {
        'CNIC / ID': 'CNIC_ID',
        'Personal Email': 'Personal_Email',
        'Official Email': 'Official_Email',
        'Joining Date': 'Joining_Date',
        'Reporting Manager': 'Reporting_Manager',
        'Job Type': 'Job_Type',
        'Probation Period': 'Probation_Period',
        'Probation End Date': 'Probation_End_Date',
        'Contact Number': 'Contact_Number',
        'Bank Name': 'Bank_Name',
        'Bank Account Title': 'Bank_Account_Title',
        'Bank Account Number-IBAN (24 digits)': 'Bank_Account_Number_IBAN',
        'Swift Code/ BIC Code': 'Swift_Code_BIC',
        'Routing Number': 'Routing_Number',
        'Employment Location': 'Employment_Location',
        'Date of Birth': 'Date_of_Birth',
        'Marital Status': 'Marital_Status',
        "Father's Name": 'Fathers_Name',  # Note: BigQuery table uses Fathers_Name (no apostrophe)
        "Emergency Contact's Relationship": 'Emergency_Contact_Relationship',
        'Emergency Contact Number': 'Emergency_Contact_Number',
        'Blood Group': 'Blood_Group',
        'LinkedIn URL': 'LinkedIn_URL',
        'Recruiter Name': 'Recruiter_Name',
        'Employment End Date': 'Employment_End_Date',
        'Group Name': 'Group_Name',
        'Group Email': 'Group_Email',
        'Re-Joined': 'Re_Joined',
    }
    
    # Rename columns
    df = df.rename(columns=column_mapping)
    
    # Ensure ID is INT64
    df['ID'] = pd.to_numeric(df['ID'], errors='coerce').astype('Int64')
    
    # Only keep columns that exist in Directory_Employees_Data table
    valid_columns = [
        'ID', 'Name', 'Personal_Email', 'Official_Email', 'Joining_Date',
        'Designation', 'Department', 'Reporting_Manager', 'Job_Type', 'Status',
        'Probation_Period', 'Probation_End_Date', 'Contact_Number', 'CNIC_ID',
        'Gender', 'Bank_Name', 'Bank_Account_Title', 'Bank_Account_Number_IBAN',
        'Swift_Code_BIC', 'Routing_Number', 'Employment_Location', 'Date_of_Birth',
        'Age', 'Address', 'Nationality', 'Marital_Status', 'Fathers_Name',
        'Emergency_Contact_Relationship', 'Emergency_Contact_Number', 'Blood_Group',
        'LinkedIn_URL', 'Recruiter_Name', 'Employment_End_Date', 'Group_Name',
        'Group_Email', 'Re_Joined', 'Status_Duplicate', 'Key'
    ]
    
    # Select only columns that exist in both DataFrame and valid_columns
    columns_to_keep = [col for col in valid_columns if col in df.columns]
    df = df[columns_to_keep]
    
    # Convert date columns to DATE type (YYYY-MM-DD format)
    date_columns = ['Joining_Date', 'Probation_End_Date', 'Date_of_Birth', 'Employment_End_Date']
    for col in date_columns:
        if col in df.columns:
            parsed_series = df[col].apply(parse_date)
            df[col] = pd.to_datetime(parsed_series, errors='coerce').dt.date
    
    # Add missing required columns with default values
    if 'Status_Duplicate' not in df.columns:
        df['Status_Duplicate'] = None
    if 'Key' not in df.columns:
        # Generate Key from Father_Name + Name + ID if available
        df['Key'] = df.apply(
            lambda row: f"{row.get('Fathers_Name', '')}{row.get('Name', '')}{row.get('ID', '')}" 
            if pd.notna(row.get('ID')) else None, 
            axis=1
        )
    if 'Loaded_At' not in df.columns:
        df['Loaded_At'] = datetime.now()
    
    return df

def add_to_bigquery(df):
    """Add missing employees to Directory_Employees_Data"""
    if len(df) == 0:
        log("No missing employees to add")
        return
    
    log(f"Adding {len(df)} missing employees to {DIRECTORY_TABLE}...")
    
    try:
        to_gbq(
            df,
            DIRECTORY_TABLE,
            project_id=PROJECT_ID,
            if_exists='append',  # Append, don't replace
            progress_bar=True
        )
        log(f"✅ Successfully added {len(df)} employees")
    except Exception as e:
        log(f"❌ Error: {e}")
        raise

def verify_counts():
    """Verify final counts in Employees table"""
    client = bigquery.Client(project=PROJECT_ID)
    query = f"""
    SELECT Employment_Status, COUNT(*) as count 
    FROM `{EMPLOYEES_TABLE}` 
    GROUP BY Employment_Status
    ORDER BY Employment_Status
    """
    df = client.query(query).to_dataframe()
    
    log("\n" + "="*80)
    log("FINAL EMPLOYEE COUNTS")
    log("="*80)
    for _, row in df.iterrows():
        log(f"  {row['Employment_Status']}: {row['count']}")
    log(f"  TOTAL: {df['count'].sum()}")
    log("="*80)
    
    return df

def main():
    log("="*80)
    log("IDENTIFY AND ADD MISSING EMPLOYEES")
    log("="*80)
    
    # Extract missing employees
    missing_df = extract_missing_employees()
    
    if len(missing_df) == 0:
        log("✅ All employees from CSV files already exist in Employees table")
        verify_counts()
        return
    
    log(f"\nFound {len(missing_df)} missing employees to add")
    
    # Map to schema
    missing_df = map_to_directory_schema(missing_df)
    
    # Add to BigQuery Directory_Employees_Data
    add_to_bigquery(missing_df)
    
    log("\n" + "="*80)
    log("✅ COMPLETE - Missing employees added to Directory_Employees_Data")
    log("Next step: Re-run migrate_employee_data.py to include them in Employees table")
    log("="*80)
    
    # Show current counts
    verify_counts()

if __name__ == "__main__":
    main()


