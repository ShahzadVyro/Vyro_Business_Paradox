#!/usr/bin/env python3
"""
Add Missing Employees from CSV Files to Directory_Employees_Data
=================================================================
Extracts employees from CSV files that don't exist in BigQuery source tables
and adds them to Directory_Employees_Data.

Usage:
    python3 database/migrations/add_missing_employees_from_csv.py
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
SOURCE_TABLE = f"{PROJECT_ID}.{DATASET_ID}.Directory_Employees_Data"

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

def get_existing_ids():
    """Get existing Employee IDs from BigQuery"""
    client = bigquery.Client(project=PROJECT_ID)
    query = f"SELECT DISTINCT ID FROM `{SOURCE_TABLE}` WHERE ID IS NOT NULL"
    df = client.query(query).to_dataframe()
    return set(df['ID'].dropna().astype(int).tolist())

def extract_missing_employees():
    """Extract missing employees from CSV files"""
    # Load CSV files
    df_active = pd.read_csv('Active Employees.csv')
    df_resigned = pd.read_csv('Resigned:Terminated Employees.csv')
    
    # Filter valid rows
    df_active_clean = df_active[(df_active['ID'].notna()) & (df_active['Name'].notna())]
    df_resigned_clean = df_resigned[(df_resigned['ID'].notna()) & (df_resigned['Name'].notna())]
    
    # Get existing IDs
    existing_ids = get_existing_ids()
    log(f"Found {len(existing_ids)} existing Employee IDs in BigQuery")
    
    # Find missing employees
    missing_active = df_active_clean[~df_active_clean['ID'].astype(int).isin(existing_ids)]
    missing_resigned = df_resigned_clean[~df_resigned_clean['ID'].astype(int).isin(existing_ids)]
    
    log(f"Missing Active employees: {len(missing_active)}")
    log(f"Missing Resigned/Terminated employees: {len(missing_resigned)}")
    
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
    # These are the columns that exist in the table (from schema check)
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
    
    log(f"Adding {len(df)} missing employees to {SOURCE_TABLE}...")
    
    try:
        to_gbq(
            df,
            SOURCE_TABLE,
            project_id=PROJECT_ID,
            if_exists='append',  # Append, don't replace
            progress_bar=True
        )
        log(f"✅ Successfully added {len(df)} employees")
    except Exception as e:
        log(f"❌ Error: {e}")
        raise

def main():
    log("="*80)
    log("ADD MISSING EMPLOYEES FROM CSV FILES")
    log("="*80)
    
    # Extract missing employees
    missing_df = extract_missing_employees()
    
    if len(missing_df) == 0:
        log("✅ All employees from CSV files already exist in BigQuery")
        return
    
    # Map to schema
    missing_df = map_to_directory_schema(missing_df)
    
    # Add to BigQuery
    add_to_bigquery(missing_df)
    
    log("="*80)
    log("✅ COMPLETE - Re-run migration to include these employees")
    log("="*80)

if __name__ == "__main__":
    main()

