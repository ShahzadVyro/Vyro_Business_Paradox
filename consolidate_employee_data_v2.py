#!/usr/bin/env python3
"""
Employee Data Consolidation Script v2
======================================
Improved version that handles:
- Headers in row 1, 2, 3, or 4
- Only processes relevant sheets (Active, ResignedTerminated, Employees Data, Employee_Information)
- Ignores copy/backup sheets
- Better change tracking

Author: AI Assistant
Date: October 30, 2025
"""

import pandas as pd
import numpy as np
from datetime import datetime
import warnings
import json
import os

warnings.filterwarnings('ignore')

# Configuration
INPUT_FILE = 'RAWSheetData/Employee Directory __ Vyro - V1.xlsx'
OUTPUT_FILE = 'RAWSheetData/Employee Directory - CONSOLIDATED_v2.xlsx'
ANALYSIS_DIR = 'EmployeeData'

# Only these sheets are used (rest are copies/old data)
SHEETS_TO_PROCESS = {
    'Active': 'Active',
    'ResignedTerminated': 'Resigned/Terminated',
    'Employees Data': 'Active',  # Assume active unless marked otherwise
    'Employee_Information': 'Active'  # Form submissions are new joiners
}

# Field mapping to standardize column names across sheets
FIELD_MAPPING = {
    'Email Address': 'Official_Email',
    'Full Name': 'Full_Name',
    'Name': 'Full_Name',
    'CNIC / ID': 'National_ID',
    'Personal Email': 'Personal_Email',
    'Contact Number': 'Contact_Number',
    'Date of Birth': 'Date_of_Birth',
    'Gender': 'Gender',
    'Address': 'Current_Address',
    'Permanent Address': 'Permanent_Address',
    'Nationality': 'Nationality',
    'LinkedIn URL': 'LinkedIn_Profile_URL',
    'Marital Status': 'Marital_Status',
    'Joining Date': 'Joining_Date',
    'Department': 'Department',
    'Designation': 'Designation',
    'Reporting Manager': 'Reporting_Manager',
    'Job Type': 'Job_Type',
    'Recruiter Name': 'Recruiter_Name',
    'Preferred Device ': 'Preferred_Device',
    "Father's Name": 'Father_Name',
    'Emergency Contact Number': 'Emergency_Contact_Number',
    "Emergency Contact's Relationship": 'Emergency_Contact_Relationship',
    'Blood Group': 'Blood_Group',
    'Bank Name': 'Bank_Name',
    'Bank Account Title': 'Bank_Account_Title',
    'National Tax Number (NTN)': 'National_Tax_Number',
    'Swift Code/ BIC Code': 'Swift_Code_BIC',
    'Bank Account Number-IBAN (24 digits)': 'Account_Number_IBAN',
    'Vehicle Number': 'Vehicle_Number',
    'Shirt Size?': 'Shirt_Size',
    'Resume / CV': 'Resume_URL',
    'Job Location': 'Job_Location',
    'ID': 'Employee_ID',
    'Status': 'Employment_Status',
    'Probation Period': 'Probation_Period_Months',
    'Probation End Date': 'Probation_End_Date',
    'Basic Salary': 'Basic_Salary',
    'Medical': 'Medical_Allowance',
    'Gross Salary': 'Gross_Salary',
    'Employment Location': 'Job_Location',
    'Age': 'Age',
    'Number of Children': 'Number_of_Children',
    'Spouse - Name': 'Spouse_Name',
    'Spouse DOB': 'Spouse_DOB',
    'Employment End Date': 'Employment_End_Date',
    'Re-Joined': 'Rejoined',
    'IBFT / IFT': 'IFT_Type',
    'Passport Size Picture (Blue background Only)': 'Passport_Photo_URL',
    'Scanned Copy of CNIC (Front)': 'CNIC_Front_URL',
    'Scanned Copy of CNIC (Back)': 'CNIC_Back_URL',
    'Degree/Latest Transcript': 'Degree_Transcript_URL',
    'Last Salary Slip': 'Last_Salary_Slip_URL',
    'Previous Company Experience Letter': 'Experience_Letter_URL',
    'Share a brief introduction that we can use in our official communication channels.': 'Introduction_Bio',
    'A fun fact about you that you would like to share with the team.': 'Fun_Fact',
    'Routing Number': 'Routing_Number',
    'Timestamp': 'Form_Submission_Timestamp',
}

def log(message):
    """Print timestamped log message"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def detect_header_row(file_path, sheet_name, max_rows_to_check=10):
    """
    Detect which row contains the headers (could be row 1, 2, 3, or 4)
    
    Strategy:
    - Read first N rows
    - Look for row with most non-null string values
    - Look for common header keywords (Name, Email, ID, Department, etc.)
    """
    log(f"  Detecting header row for sheet: {sheet_name}")
    
    # Read first few rows without headers
    df_preview = pd.read_excel(file_path, sheet_name=sheet_name, header=None, nrows=max_rows_to_check)
    
    header_keywords = [
        'id', 'name', 'email', 'cnic', 'department', 'designation', 
        'joining', 'status', 'date', 'contact', 'phone', 'address',
        'manager', 'salary', 'employee'
    ]
    
    best_header_row = 0
    best_score = 0
    
    for row_idx in range(min(5, len(df_preview))):  # Check first 5 rows max
        row = df_preview.iloc[row_idx]
        
        # Count how many cells are strings (not numbers)
        string_count = sum(isinstance(val, str) for val in row if pd.notna(val))
        
        # Count how many header keywords are found
        keyword_count = 0
        for val in row:
            if isinstance(val, str):
                val_lower = val.lower()
                if any(keyword in val_lower for keyword in header_keywords):
                    keyword_count += 1
        
        # Score = string count + (keyword count * 2)
        score = string_count + (keyword_count * 2)
        
        log(f"    Row {row_idx + 1}: {string_count} strings, {keyword_count} keywords, score={score}")
        
        if score > best_score:
            best_score = score
            best_header_row = row_idx
    
    log(f"  ✅ Detected header row: {best_header_row + 1} (0-indexed: {best_header_row})")
    return best_header_row

def load_sheet_with_auto_header(file_path, sheet_name, default_status):
    """Load a sheet with automatic header detection"""
    log(f"\nLoading sheet: {sheet_name}")
    
    # Detect header row
    header_row = detect_header_row(file_path, sheet_name)
    
    # Read with detected header
    df = pd.read_excel(file_path, sheet_name=sheet_name, header=header_row)
    
    log(f"  Loaded {len(df)} rows with {len(df.columns)} columns")
    log(f"  First 5 column names: {list(df.columns)[:5]}")
    
    # Standardize column names
    df.columns = df.columns.str.strip()
    df = df.rename(columns=FIELD_MAPPING)
    
    # Remove completely empty rows
    df = df.dropna(how='all')
    
    # Set default employment status if not present
    if 'Employment_Status' not in df.columns:
        df['Employment_Status'] = default_status
    
    # Add source sheet for tracking
    df['Source_Sheet'] = sheet_name
    
    log(f"  After cleaning: {len(df)} rows")
    
    return df

def merge_all_data():
    """Merge data from relevant sheets only"""
    log("\n" + "="*80)
    log("MERGING EMPLOYEE DATA FROM ACTIVE SHEETS")
    log("="*80)
    
    all_dataframes = []
    
    for sheet_name, default_status in SHEETS_TO_PROCESS.items():
        try:
            df = load_sheet_with_auto_header(INPUT_FILE, sheet_name, default_status)
            if df is not None and len(df) > 0:
                all_dataframes.append(df)
        except Exception as e:
            log(f"  ⚠️  Error loading {sheet_name}: {e}")
            continue
    
    if not all_dataframes:
        log("ERROR: No data could be loaded from any sheet!")
        return None
    
    # Combine all dataframes
    log(f"\nCombining {len(all_dataframes)} data sources...")
    combined_df = pd.concat(all_dataframes, ignore_index=True, sort=False)
    
    log(f"Total rows after combining: {len(combined_df)}")
    
    return combined_df

def clean_phone_number(value):
    """Clean and standardize phone numbers"""
    if pd.isna(value):
        return None
    value_str = str(value)
    if value_str.lower() in ['nan', 'none', '', 'nat']:
        return None
    cleaned = ''.join(c for c in value_str if c.isdigit() or c == '+')
    return cleaned if cleaned else None

def clean_date(value):
    """Clean and standardize dates"""
    if pd.isna(value):
        return None
    try:
        if isinstance(value, (datetime, pd.Timestamp)):
            return value.date()
        return pd.to_datetime(value).date()
    except:
        return None

def clean_email(value):
    """Clean and standardize email addresses"""
    if pd.isna(value):
        return None
    value_str = str(value).strip().lower()
    if value_str in ['nan', 'none', '', 'n/a']:
        return None
    if '@' not in value_str:
        return None
    return value_str

def deduplicate_employees(df):
    """Remove duplicate employees, keeping most recent/complete record"""
    log("\n" + "="*80)
    log("DEDUPLICATION")
    log("="*80)
    
    initial_count = len(df)
    log(f"Initial row count: {initial_count}")
    
    # Priority order for deduplication:
    # 1. Official Email (most reliable)
    # 2. National ID (CNIC)
    # 3. Full Name (least reliable)
    
    # First by Official Email
    if 'Official_Email' in df.columns:
        df['Official_Email'] = df['Official_Email'].apply(clean_email)
        
        # For each email, keep the row with most non-null values
        df['_completeness'] = df.notna().sum(axis=1)
        df = df.sort_values(['Official_Email', '_completeness'], ascending=[True, False])
        
        email_dupes_before = df['Official_Email'].notna() & df['Official_Email'].duplicated(keep=False)
        df = df.drop_duplicates(subset=['Official_Email'], keep='first')
        email_dupes_removed = email_dupes_before.sum() - df['Official_Email'].notna().duplicated().sum()
        log(f"  Removed {email_dupes_removed} duplicates by Official Email")
        
        df = df.drop('_completeness', axis=1)
    
    # Then by National ID
    if 'National_ID' in df.columns:
        df['National_ID'] = df['National_ID'].astype(str).replace('nan', None)
        
        df['_completeness'] = df.notna().sum(axis=1)
        df = df.sort_values(['National_ID', '_completeness'], ascending=[True, False], na_position='last')
        
        id_dupes_before = df['National_ID'].notna() & df['National_ID'].duplicated(keep=False)
        df = df.drop_duplicates(subset=['National_ID'], keep='first')
        id_dupes_removed = id_dupes_before.sum() - df['National_ID'].notna().duplicated().sum()
        log(f"  Removed {id_dupes_removed} duplicates by National ID")
        
        df = df.drop('_completeness', axis=1)
    
    # Finally by Full Name (less reliable)
    if 'Full_Name' in df.columns:
        df['Full_Name'] = df['Full_Name'].astype(str).replace('nan', None)
        
        df['_completeness'] = df.notna().sum(axis=1)
        df = df.sort_values(['Full_Name', '_completeness'], ascending=[True, False], na_position='last')
        
        name_dupes_before = df['Full_Name'].notna() & df['Full_Name'].duplicated(keep=False)
        df = df.drop_duplicates(subset=['Full_Name'], keep='first')
        name_dupes_removed = name_dupes_before.sum() - df['Full_Name'].notna().duplicated().sum()
        log(f"  Removed {name_dupes_removed} duplicates by Full Name")
        
        df = df.drop('_completeness', axis=1)
    
    final_count = len(df)
    removed = initial_count - final_count
    log(f"Final row count: {final_count}")
    log(f"Total removed: {removed} duplicate rows ({removed/initial_count*100:.1f}%)")
    
    return df

def clean_and_validate(df):
    """Clean and validate data"""
    log("\n" + "="*80)
    log("DATA CLEANING")
    log("="*80)
    
    # Clean phone numbers
    for col in ['Contact_Number', 'Emergency_Contact_Number']:
        if col in df.columns:
            df[col] = df[col].apply(clean_phone_number)
    
    # Clean emails
    for col in ['Official_Email', 'Personal_Email']:
        if col in df.columns:
            df[col] = df[col].apply(clean_email)
    
    # Clean dates
    date_columns = ['Date_of_Birth', 'Joining_Date', 'Employment_End_Date', 
                   'Probation_End_Date', 'Spouse_DOB']
    for col in date_columns:
        if col in df.columns:
            df[col] = df[col].apply(clean_date)
    
    # Generate Employee IDs if missing
    if 'Employee_ID' not in df.columns or df['Employee_ID'].isna().any():
        log("  Generating Employee IDs for records without IDs...")
        
        if 'Employee_ID' not in df.columns:
            df['Employee_ID'] = None
        
        missing_ids = df['Employee_ID'].isna()
        num_missing = missing_ids.sum()
        
        if num_missing > 0:
            existing_ids = df[~missing_ids]['Employee_ID'].astype(str)
            max_id = 0
            for emp_id in existing_ids:
                if isinstance(emp_id, str) and emp_id.startswith('EMP-'):
                    try:
                        num = int(emp_id.split('-')[1])
                        max_id = max(max_id, num)
                    except:
                        pass
            
            new_ids = [f"EMP-{max_id + i + 1:04d}" for i in range(num_missing)]
            df.loc[missing_ids, 'Employee_ID'] = new_ids
            log(f"  Generated {num_missing} new Employee IDs (starting from EMP-{max_id+1:04d})")
    
    # Add system timestamps
    now = datetime.now()
    if 'Created_At' not in df.columns:
        df['Created_At'] = now
    if 'Updated_At' not in df.columns:
        df['Updated_At'] = now
    
    # Initialize change tracking fields
    if 'Department_Change_History' not in df.columns:
        df['Department_Change_History'] = None
    if 'Designation_Change_History' not in df.columns:
        df['Designation_Change_History'] = None
    if 'Change_Details' not in df.columns:
        df['Change_Details'] = None
    
    log("Data cleaning completed")
    
    return df

def generate_statistics(df):
    """Generate statistics about the consolidated data"""
    log("\n" + "="*80)
    log("DATA STATISTICS")
    log("="*80)
    
    stats = {
        'total_employees': len(df),
        'by_status': df['Employment_Status'].value_counts().to_dict() if 'Employment_Status' in df.columns else {},
        'by_source': df['Source_Sheet'].value_counts().to_dict() if 'Source_Sheet' in df.columns else {},
        'by_department': df['Department'].value_counts().head(10).to_dict() if 'Department' in df.columns else {},
        'data_quality': {
            'with_email': df['Official_Email'].notna().sum() if 'Official_Email' in df.columns else 0,
            'with_phone': df['Contact_Number'].notna().sum() if 'Contact_Number' in df.columns else 0,
            'with_department': df['Department'].notna().sum() if 'Department' in df.columns else 0,
            'with_joining_date': df['Joining_Date'].notna().sum() if 'Joining_Date' in df.columns else 0,
        },
        'completeness_percentage': (df.notna().sum().sum() / (len(df) * len(df.columns)) * 100) if len(df) > 0 else 0,
    }
    
    log(f"  Total Employees: {stats['total_employees']}")
    log(f"\n  By Employment Status:")
    for status, count in stats['by_status'].items():
        log(f"    {status}: {count}")
    
    log(f"\n  By Source Sheet:")
    for source, count in stats['by_source'].items():
        log(f"    {source}: {count}")
    
    log(f"\n  Data Quality:")
    for metric, count in stats['data_quality'].items():
        pct = (count / stats['total_employees'] * 100) if stats['total_employees'] > 0 else 0
        log(f"    {metric}: {count} ({pct:.1f}%)")
    
    # Save statistics
    stats_file = os.path.join(ANALYSIS_DIR, 'consolidation_statistics_v2.json')
    with open(stats_file, 'w') as f:
        json.dump(stats, f, indent=2, default=str)
    log(f"\n  Statistics saved to: {stats_file}")
    
    return stats

def save_consolidated_data(df):
    """Save consolidated data to Excel"""
    log("\n" + "="*80)
    log("SAVING CONSOLIDATED DATA")
    log("="*80)
    
    with pd.ExcelWriter(OUTPUT_FILE, engine='openpyxl') as writer:
        # Main consolidated sheet
        df.to_excel(writer, sheet_name='Master_Employee_Data', index=False)
        log(f"  Saved Master_Employee_Data sheet ({len(df)} rows)")
        
        # Active employees
        if 'Employment_Status' in df.columns:
            active_df = df[df['Employment_Status'].str.contains('Active', na=False, case=False)].copy()
            active_df.to_excel(writer, sheet_name='Active_Employees', index=False)
            log(f"  Saved Active_Employees sheet ({len(active_df)} rows)")
            
            # Resigned/Terminated employees
            resigned_df = df[df['Employment_Status'].str.contains('Resigned|Terminated', na=False, case=False)].copy()
            resigned_df.to_excel(writer, sheet_name='Former_Employees', index=False)
            log(f"  Saved Former_Employees sheet ({len(resigned_df)} rows)")
        
        # Data quality report
        quality_report = pd.DataFrame({
            'Column': df.columns,
            'Non_Null_Count': df.notna().sum().values,
            'Null_Count': df.isna().sum().values,
            'Completeness_%': ((df.notna().sum() / len(df)) * 100).values
        })
        quality_report = quality_report.sort_values('Completeness_%', ascending=False)
        quality_report.to_excel(writer, sheet_name='Data_Quality_Report', index=False)
        log(f"  Saved Data_Quality_Report sheet")
    
    log(f"\n✅ Consolidated data saved to: {OUTPUT_FILE}")

def main():
    """Main execution function"""
    log("="*80)
    log("EMPLOYEE DATA CONSOLIDATION SCRIPT V2")
    log("="*80)
    log("Improvements:")
    log("  - Auto-detects header row (handles row 1, 2, 3, or 4)")
    log("  - Only processes active sheets (ignores copies/backups)")
    log("  - Better deduplication (keeps most complete record)")
    log("  - Prepares for change tracking")
    log("="*80)
    
    os.makedirs(ANALYSIS_DIR, exist_ok=True)
    
    # Merge all data
    consolidated_df = merge_all_data()
    
    if consolidated_df is None or len(consolidated_df) == 0:
        log("\nERROR: No data was consolidated. Exiting.")
        return
    
    # Deduplicate
    consolidated_df = deduplicate_employees(consolidated_df)
    
    # Clean and validate
    consolidated_df = clean_and_validate(consolidated_df)
    
    # Generate statistics
    generate_statistics(consolidated_df)
    
    # Save
    save_consolidated_data(consolidated_df)
    
    log("\n" + "="*80)
    log("✅ CONSOLIDATION COMPLETED!")
    log("="*80)

if __name__ == "__main__":
    main()

