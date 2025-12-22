#!/usr/bin/env python3
"""
Migrate Employee Data to Unified Employees Table
================================================
Consolidates EmployeeData_v2 and Directory_Employees_Data into unified Employees table.
CRITICAL: Preserves all existing Employee_IDs exactly as they are.

Prerequisites:
    - BigQuery Employees table must exist
    - Google Cloud credentials configured
    - pandas and google-cloud-bigquery libraries installed

Usage:
    python3 database/migrations/migrate_employee_data.py

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
SOURCE_TABLE_V2 = f"{PROJECT_ID}.{DATASET_ID}.EmployeeData_v2"
SOURCE_TABLE_DIR = f"{PROJECT_ID}.{DATASET_ID}.Directory_Employees_Data"
TARGET_TABLE = f"{PROJECT_ID}.{DATASET_ID}.Employees"

# Set credentials path
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'Credentials/test-imagine-web-18d4f9a43aef.json'

def log(message):
    """Print timestamped log message"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def clean_numeric_id(value):
    """Clean and convert to numeric ID, preserving existing format"""
    if pd.isna(value) or value == '':
        return None
    if isinstance(value, (int, float)):
        return int(value)
    # Try to extract numeric part
    try:
        # If it's a string like "EMP-0001", extract the number
        if isinstance(value, str) and 'EMP-' in value.upper():
            num_part = value.upper().replace('EMP-', '').strip()
            return int(num_part) if num_part.isdigit() else None
        # Otherwise try direct conversion
        return int(float(str(value).replace(',', '').strip()))
    except (ValueError, TypeError):
        return None

def parse_date(value):
    """Parse date string to datetime"""
    if pd.isna(value) or value == '':
        return None
    if isinstance(value, datetime):
        return value
    try:
        for fmt in ['%d-%b-%y', '%d-%B-%y', '%d-%b-%Y', '%d-%B-%Y', '%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%d-%m-%Y']:
            try:
                return pd.to_datetime(value, format=fmt)
            except:
                continue
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

def normalize_employment_status(status):
    """Normalize employment status values"""
    if pd.isna(status) or status is None or str(status).strip() == '':
        return None  # Will be handled separately
    
    status_str = str(status).strip()
    status_lower = status_str.lower()
    
    # Active variants
    if status_lower in ['active', 'current']:
        return 'Active'
    
    # Resigned/Terminated variants
    if status_lower in ['resigned', 'terminated', 'inactive', 'resigned/terminated']:
        return 'Resigned/Terminated'
    
    # Unknown - default to Active for safety
    return 'Active'

def load_reference_status_files():
    """Load Active and Resigned/Terminated employee lists from CSV files"""
    try:
        df_active = pd.read_csv('Active Employees.csv')
        df_resigned = pd.read_csv('Resigned:Terminated Employees.csv')
        
        # Filter out empty rows (rows where ID is null or Name is null)
        df_active_clean = df_active[(df_active['ID'].notna()) & (df_active['Name'].notna())]
        df_resigned_clean = df_resigned[(df_resigned['ID'].notna()) & (df_resigned['Name'].notna())]
        
        # Extract unique Employee IDs
        active_ids = set(df_active_clean['ID'].astype(int).unique().tolist())
        resigned_ids = set(df_resigned_clean['ID'].astype(int).unique().tolist())
        
        log(f"Loaded reference files: {len(active_ids)} Active, {len(resigned_ids)} Resigned/Terminated")
        log(f"  (Filtered from {len(df_active)} total rows to {len(df_active_clean)} valid rows)")
        log(f"  (Filtered from {len(df_resigned)} total rows to {len(df_resigned_clean)} valid rows)")
        
        return active_ids, resigned_ids
    except Exception as e:
        log(f"⚠️  Could not load reference CSV files: {e}")
        return None, None

def load_from_bigquery(table_id):
    """Load data from BigQuery table"""
    log(f"Loading data from {table_id}...")
    client = bigquery.Client(project=PROJECT_ID)
    
    try:
        query = f"SELECT * FROM `{table_id}`"
        df = client.query(query).to_dataframe()
        log(f"Loaded {len(df)} rows from {table_id}")
        return df
    except Exception as e:
        log(f"⚠️  Could not load from {table_id}: {e}")
        return None

def consolidate_employee_data():
    """Consolidate employee data from both sources"""
    log("="*80)
    log("CONSOLIDATING EMPLOYEE DATA")
    log("="*80)
    
    # Load data from both sources
    df_v2 = load_from_bigquery(SOURCE_TABLE_V2)
    df_dir = load_from_bigquery(SOURCE_TABLE_DIR)
    
    if df_v2 is None and df_dir is None:
        log("ERROR: No source data available")
        return None
    
    # Start with Directory_Employees_Data as primary source (has INT64 IDs)
    if df_dir is not None:
        log(f"Using Directory_Employees_Data as primary source ({len(df_dir)} rows)")
        df_primary = df_dir.copy()
        
        # Map column names from Directory to Employees schema
        column_mapping = {
            'ID': 'Employee_ID',
            'Name': 'Full_Name',
            'Personal Email': 'Personal_Email',
            'Official Email': 'Official_Email',
            'Joining Date': 'Joining_Date',
            'Designation': 'Designation',
            'Department': 'Department',
            'Reporting Manager': 'Reporting_Manager',
            'Job Type': 'Job_Type',
            'Status': 'Employment_Status',
            'Probation Period': 'Probation_Period',
            'Probation End Date': 'Probation_End_Date',
            'Contact Number': 'Contact_Number',
            'CNIC / ID': 'CNIC_ID',
            'Gender': 'Gender',
            'Bank Name': 'Bank_Name',
            'Bank Account Title': 'Bank_Account_Title',
            'Bank Account Number-IBAN (24 digits)': 'Bank_Account_Number_IBAN',
            'Swift Code/ BIC Code': 'Swift_Code_BIC',
            'Routing Number': 'Routing_Number',
            'Employment Location': 'Employment_Location',
            'Date of Birth': 'Date_of_Birth',
            'Age': 'Age',
            'Address': 'Temporary_Address',
            'Nationality': 'Nationality',
            'Marital Status': 'Marital_Status',
            "Father's Name": 'Father_Name',
            "Emergency Contact's Relationship": 'Emergency_Contact_Relationship',
            'Emergency Contact Number': 'Emergency_Contact_Number',
            'Blood Group': 'Blood_Group',
            'LinkedIn URL': 'LinkedIn_URL',
            'Recruiter Name': 'Recruiter_Name',
            'Employment End Date': 'Employment_End_Date',
            'Group Name': 'Group_Name',
            'Group Email': 'Group_Email',
            'Re-Joined': 'Re_Joined',
            'Status_Duplicate': 'Status_Duplicate',  # Changed from 'Employment_Status' to avoid duplicate
            'Key': 'Key',
        }
        
        # Rename columns
        for old_col, new_col in column_mapping.items():
            if old_col in df_primary.columns:
                df_primary = df_primary.rename(columns={old_col: new_col})
        
        # Ensure Employee_ID is INT64
        if 'Employee_ID' in df_primary.columns:
            df_primary['Employee_ID'] = df_primary['Employee_ID'].apply(clean_numeric_id)
        
        # Note: Employment_Status will be set later using reference files
        # This happens after merging additional fields
        
    else:
        log("Using EmployeeData_v2 as primary source")
        df_primary = df_v2.copy()
        
        # Convert Employee_ID from STRING to INT64 (extract numeric part)
        if 'Employee_ID' in df_primary.columns:
            df_primary['Employee_ID'] = df_primary['Employee_ID'].apply(clean_numeric_id)
        
        # Note: Employment_Status will be set later using reference files
        # This happens after merging additional fields
    
    # Merge additional fields from EmployeeData_v2 if available
    if df_v2 is not None and df_dir is not None:
        log("Merging additional fields from EmployeeData_v2...")
        
        # Convert EmployeeData_v2 Employee_ID to numeric for matching
        df_v2['Employee_ID_Numeric'] = df_v2['Employee_ID'].apply(clean_numeric_id)
        
        # Merge on Employee_ID, filling missing values from v2
        # Only merge fields that don't exist in primary or are null
        merge_fields = ['Profile_Picture_URL', 'Resume_URL', 'CNIC_Front_URL', 'CNIC_Back_URL',
                       'Degree_Transcript_URL', 'Last_Salary_Slip_URL', 'Experience_Letter_URL',
                       'Passport_Photo_URL', 'Shirt_Size', 'Vehicle_Number', 'Introduction', 'Fun_Fact']
        
        for field in merge_fields:
            if field in df_v2.columns:
                # Create mapping
                v2_mapping = df_v2[['Employee_ID_Numeric', field]].dropna(subset=['Employee_ID_Numeric'])
                v2_mapping = v2_mapping.set_index('Employee_ID_Numeric')[field].to_dict()
                
                # Fill missing values
                if field not in df_primary.columns:
                    df_primary[field] = None
                
                mask = df_primary[field].isna() & df_primary['Employee_ID'].notna()
                df_primary.loc[mask, field] = df_primary.loc[mask, 'Employee_ID'].map(v2_mapping)
    
    # Load reference status files and set Employment_Status
    active_ids, resigned_ids = load_reference_status_files()
    
    # Set Employment_Status based on reference files
    if active_ids is not None and resigned_ids is not None:
        # Use reference files as source of truth
        log("Using reference CSV files to determine Employment_Status...")
        
        def set_status_from_reference(employee_id):
            if pd.isna(employee_id):
                return None  # Will be handled later
            try:
                emp_id = int(employee_id)
                if emp_id in active_ids:
                    return 'Active'
                elif emp_id in resigned_ids:
                    return 'Resigned/Terminated'
                else:
                    # Not found in either list - use normalization as fallback
                    return None
            except (ValueError, TypeError):
                return None
        
        # Set Employment_Status based on reference files
        df_primary['Employment_Status'] = df_primary['Employee_ID'].apply(set_status_from_reference)
        
        # For employees not in reference files, use normalization
        mask_not_found = df_primary['Employment_Status'].isna()
        if mask_not_found.any():
            log(f"⚠️  {mask_not_found.sum()} employees not found in reference files, using normalization")
            if 'Status' in df_primary.columns or 'Status_Duplicate' in df_primary.columns:
                status_col = 'Status' if 'Status' in df_primary.columns else 'Status_Duplicate'
                df_primary.loc[mask_not_found, 'Employment_Status'] = df_primary.loc[mask_not_found, status_col].apply(normalize_employment_status)
                # Handle remaining NULLs
                df_primary.loc[df_primary['Employment_Status'].isna(), 'Employment_Status'] = 'Active'
            else:
                df_primary.loc[mask_not_found, 'Employment_Status'] = 'Active'
    else:
        # Fallback to normalization if reference files not available
        log("⚠️  Reference files not available, using normalization function")
        if 'Employment_Status' not in df_primary.columns:
            df_primary['Employment_Status'] = 'Active'
        else:
            # Normalize existing Employment_Status
            df_primary['Employment_Status'] = df_primary['Employment_Status'].apply(normalize_employment_status)
            # Handle NULL values based on Employment_End_Date
            if 'Employment_End_Date' in df_primary.columns:
                mask_null = df_primary['Employment_Status'].isna()
                mask_has_end_date = df_primary['Employment_End_Date'].notna()
                df_primary.loc[mask_null & mask_has_end_date, 'Employment_Status'] = 'Resigned/Terminated'
                df_primary.loc[mask_null & ~mask_has_end_date, 'Employment_Status'] = 'Active'
            else:
                df_primary.loc[df_primary['Employment_Status'].isna(), 'Employment_Status'] = 'Active'
    
    # Set Lifecycle_Status based on Employment_Status
    df_primary['Lifecycle_Status'] = df_primary['Employment_Status'].apply(
        lambda x: 'Active' if x == 'Active' else 'Resigned'
    )
    
    # Add system fields
    now = datetime.now()
    df_primary['Created_At'] = now
    df_primary['Updated_At'] = now
    df_primary['Created_By'] = 'Migration Script'
    df_primary['Is_Deleted'] = False
    
    # Remove rows without Employee_ID
    df_primary = df_primary[df_primary['Employee_ID'].notna()]
    
    log(f"Consolidated data: {len(df_primary)} rows")
    log(f"Unique Employee_IDs: {df_primary['Employee_ID'].nunique()}")
    
    # Check for duplicates
    duplicates = df_primary[df_primary.duplicated(subset=['Employee_ID'], keep=False)]
    if len(duplicates) > 0:
        log(f"⚠️  WARNING: Found {len(duplicates)} duplicate Employee_IDs")
        log("Keeping first occurrence of each Employee_ID")
        df_primary = df_primary.drop_duplicates(subset=['Employee_ID'], keep='first')
    
    return df_primary

def assign_missing_ids(df):
    """Assign numeric IDs to records missing Employee_ID"""
    log("Checking for records missing Employee_ID...")
    
    missing_mask = df['Employee_ID'].isna()
    missing_count = missing_mask.sum()
    
    if missing_count == 0:
        log("✅ All records have Employee_ID")
        return df
    
    log(f"Found {missing_count} records missing Employee_ID - assigning new numeric IDs")
    
    # Get max existing ID
    existing_ids = df[~missing_mask]['Employee_ID'].dropna()
    max_id = int(existing_ids.max()) if len(existing_ids) > 0 else 0
    
    # Assign new IDs starting from max_id + 1
    new_ids = list(range(max_id + 1, max_id + 1 + missing_count))
    df.loc[missing_mask, 'Employee_ID'] = new_ids
    
    log(f"Assigned IDs: {new_ids[0]} to {new_ids[-1]}")
    
    return df

def load_to_bigquery(df):
    """Load consolidated data to BigQuery"""
    log("="*80)
    log("LOADING TO BIGQUERY")
    log("="*80)
    log(f"Target table: {TARGET_TABLE}")
    log(f"Rows to load: {len(df)}")
    
    try:
        log("Uploading data... (this may take a few minutes)")
        
        to_gbq(
            df,
            TARGET_TABLE,
            project_id=PROJECT_ID,
            if_exists='replace',
            progress_bar=True,
            chunksize=1000
        )
        
        log("✅ Data successfully loaded to BigQuery!")
        
        # Verify the load
        client = bigquery.Client(project=PROJECT_ID)
        table = client.get_table(TARGET_TABLE)
        log(f"✅ Verified: Table now has {table.num_rows} rows")
        
        return True
        
    except Exception as e:
        log(f"❌ ERROR loading to BigQuery: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Main execution"""
    log("="*80)
    log("MIGRATE EMPLOYEE DATA TO UNIFIED EMPLOYEES TABLE")
    log("="*80)
    log("CRITICAL: This script preserves all existing Employee_IDs")
    log("="*80)
    
    # Step 1: Consolidate data
    df = consolidate_employee_data()
    if df is None or len(df) == 0:
        log("❌ No data to migrate")
        return
    
    # Step 2: Assign missing IDs
    df = assign_missing_ids(df)
    
    # Step 3: Load to BigQuery
    success = load_to_bigquery(df)
    
    if success:
        log("\n" + "="*80)
        log("✅ MIGRATION COMPLETED SUCCESSFULLY!")
        log("="*80)
        log(f"\nSummary:")
        log(f"  - Total employees: {len(df)}")
        log(f"  - Unique Employee_IDs: {df['Employee_ID'].nunique()}")
        log(f"  - All existing IDs preserved")
        log(f"  - New IDs assigned only for missing records")
        log("="*80)
    else:
        log("\n❌ Migration failed. Please check errors above.")

if __name__ == "__main__":
    main()

