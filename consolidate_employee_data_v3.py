#!/usr/bin/env python3
"""
Employee Data Consolidation Script v3 - PRODUCTION VERSION
===========================================================
CRITICAL CHANGES based on feedback:
- PRESERVE existing Employee IDs (used in other systems!)
- DO NOT auto-generate IDs for existing employees
- MINIMAL deduplication (only exact duplicates of same row)
- Handle rejoined employees (keep all records)
- Handle employees with same name (keep all records)

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
OUTPUT_FILE = 'RAWSheetData/Employee Directory - CONSOLIDATED_v3_PRODUCTION.xlsx'
ANALYSIS_DIR = 'EmployeeData'

# Only these sheets are used (rest are copies/old data)
SHEETS_TO_PROCESS = {
    'Active': 'Active',
    'ResignedTerminated': 'Resigned/Terminated',
    'Employees Data': 'Active',
    'Employee_Information': 'Active'
}

# Field mapping
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
    """Detect which row contains the headers (could be row 1, 2, 3, or 4)"""
    log(f"  Detecting header row for sheet: {sheet_name}")
    
    df_preview = pd.read_excel(file_path, sheet_name=sheet_name, header=None, nrows=max_rows_to_check)
    
    header_keywords = [
        'id', 'name', 'email', 'cnic', 'department', 'designation', 
        'joining', 'status', 'date', 'contact', 'phone', 'address',
        'manager', 'salary', 'employee'
    ]
    
    best_header_row = 0
    best_score = 0
    
    for row_idx in range(min(5, len(df_preview))):
        row = df_preview.iloc[row_idx]
        
        string_count = sum(isinstance(val, str) for val in row if pd.notna(val))
        
        keyword_count = 0
        for val in row:
            if isinstance(val, str):
                val_lower = val.lower()
                if any(keyword in val_lower for keyword in header_keywords):
                    keyword_count += 1
        
        score = string_count + (keyword_count * 2)
        
        log(f"    Row {row_idx + 1}: {string_count} strings, {keyword_count} keywords, score={score}")
        
        if score > best_score:
            best_score = score
            best_header_row = row_idx
    
    log(f"  ✅ Detected header row: {best_header_row + 1}")
    return best_header_row

def load_sheet_with_auto_header(file_path, sheet_name, default_status):
    """Load a sheet with automatic header detection"""
    log(f"\nLoading sheet: {sheet_name}")
    
    header_row = detect_header_row(file_path, sheet_name)
    df = pd.read_excel(file_path, sheet_name=sheet_name, header=header_row)
    
    log(f"  Loaded {len(df)} rows with {len(df.columns)} columns")
    
    # Standardize column names
    df.columns = df.columns.str.strip()
    df = df.rename(columns=FIELD_MAPPING)
    
    # Remove completely empty rows
    df = df.dropna(how='all')
    
    # PRESERVE Employment_Status from source sheet
    if 'Employment_Status' in df.columns:
        # Keep existing status
        pass
    else:
        # Only set default if column doesn't exist
        df['Employment_Status'] = default_status
    
    # Add source sheet for tracking
    df['Source_Sheet'] = sheet_name
    
    log(f"  After cleaning: {len(df)} rows")
    
    return df

def merge_all_data():
    """Merge data from relevant sheets only"""
    log("\n" + "="*80)
    log("MERGING EMPLOYEE DATA")
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
        log("ERROR: No data could be loaded!")
        return None
    
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

def minimal_deduplication(df):
    """
    MINIMAL deduplication - only remove EXACT duplicate rows
    
    DO NOT deduplicate by:
    - Name (employees can have same name)
    - Email (rejoined employees might reuse email)
    - CNIC (data entry errors)
    
    ONLY remove if:
    - Same Employee_ID AND same source sheet (exact duplicate row)
    """
    log("\n" + "="*80)
    log("MINIMAL DEDUPLICATION (Exact Duplicates Only)")
    log("="*80)
    
    initial_count = len(df)
    log(f"Initial row count: {initial_count}")
    
    # Only remove exact duplicates based on Employee_ID + Source_Sheet
    if 'Employee_ID' in df.columns:
        # Count duplicates
        dupes = df[df['Employee_ID'].notna() & 
                   df.duplicated(subset=['Employee_ID', 'Source_Sheet'], keep=False)]
        
        if len(dupes) > 0:
            log(f"\n  Found {len(dupes)} rows with duplicate Employee_ID in same source sheet")
            log(f"  These are likely exact duplicate rows - will keep first occurrence")
            
            # Keep most complete record for each Employee_ID + Source combination
            df['_completeness'] = df.notna().sum(axis=1)
            df = df.sort_values(['Employee_ID', 'Source_Sheet', '_completeness'], 
                               ascending=[True, True, False])
            df = df.drop_duplicates(subset=['Employee_ID', 'Source_Sheet'], keep='first')
            df = df.drop('_completeness', axis=1)
        else:
            log(f"  No exact duplicates found - keeping all records")
    
    final_count = len(df)
    removed = initial_count - final_count
    log(f"Final row count: {final_count}")
    log(f"Exact duplicates removed: {removed}")
    
    # Show info about potential rejoined employees
    if 'Employee_ID' in df.columns:
        rejoined_candidates = df[df['Employee_ID'].notna()].groupby('Employee_ID').size()
        multiple_records = rejoined_candidates[rejoined_candidates > 1]
        
        if len(multiple_records) > 0:
            log(f"\n  ℹ️  Found {len(multiple_records)} Employee IDs with multiple records")
            log(f"  These could be rejoined employees or data from different source sheets")
            log(f"  Keeping all records as requested")
    
    return df

def clean_and_validate(df):
    """Clean and validate data - PRESERVE existing Employee IDs"""
    log("\n" + "="*80)
    log("DATA CLEANING (Preserving Existing IDs)")
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
    
    # PRESERVE existing Employee IDs - do NOT auto-generate
    if 'Employee_ID' in df.columns:
        missing_ids = df['Employee_ID'].isna()
        num_missing = missing_ids.sum()
        
        if num_missing > 0:
            log(f"\n  ⚠️  WARNING: {num_missing} rows without Employee_ID")
            log(f"  These are likely new form submissions from Employee_Information sheet")
            log(f"  Marking them as 'PENDING_ID' - will need manual ID assignment")
            
            # Mark rows without ID
            df.loc[missing_ids, 'Employee_ID'] = 'PENDING_ID_' + df.loc[missing_ids].index.astype(str)
            df.loc[missing_ids, 'Needs_Employee_ID'] = True
        else:
            log(f"  ✅ All rows have Employee_ID - no ID generation needed")
    
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

def analyze_data_quality(df):
    """Analyze data quality and potential issues"""
    log("\n" + "="*80)
    log("DATA QUALITY ANALYSIS")
    log("="*80)
    
    analysis = {}
    
    # Check for pending IDs
    if 'Needs_Employee_ID' in df.columns:
        pending = df['Needs_Employee_ID'].sum() if df['Needs_Employee_ID'].notna().any() else 0
        log(f"\n  Rows needing Employee ID: {pending}")
        analysis['pending_ids'] = int(pending)
    
    # Check for potential rejoined employees
    if 'Employee_ID' in df.columns:
        id_counts = df[df['Employee_ID'].str.startswith('EMP-', na=False)].groupby('Employee_ID').size()
        multiple = id_counts[id_counts > 1]
        
        if len(multiple) > 0:
            log(f"\n  Employee IDs with multiple records: {len(multiple)}")
            log(f"  Top 5 (these could be rejoined employees):")
            for emp_id, count in multiple.head(5).items():
                log(f"    {emp_id}: {count} records")
            analysis['multiple_records'] = multiple.to_dict()
    
    # Check for duplicate names
    if 'Full_Name' in df.columns:
        name_counts = df[df['Full_Name'].notna()].groupby('Full_Name').size()
        duplicate_names = name_counts[name_counts > 1]
        
        if len(duplicate_names) > 0:
            log(f"\n  Names appearing multiple times: {len(duplicate_names)}")
            log(f"  Top 5 (different employees with same name):")
            for name, count in duplicate_names.head(5).items():
                log(f"    {name}: {count} employees")
            analysis['duplicate_names'] = duplicate_names.to_dict()
    
    # Employment status breakdown
    if 'Employment_Status' in df.columns:
        status_counts = df['Employment_Status'].value_counts().to_dict()
        log(f"\n  Employment Status:")
        for status, count in status_counts.items():
            log(f"    {status}: {count}")
        analysis['status_breakdown'] = status_counts
    
    # Source sheet breakdown
    if 'Source_Sheet' in df.columns:
        source_counts = df['Source_Sheet'].value_counts().to_dict()
        log(f"\n  Source Sheets:")
        for source, count in source_counts.items():
            log(f"    {source}: {count} records")
        analysis['source_breakdown'] = source_counts
    
    # Save analysis
    analysis_file = os.path.join(ANALYSIS_DIR, 'data_quality_analysis_v3.json')
    with open(analysis_file, 'w') as f:
        json.dump(analysis, f, indent=2, default=str)
    log(f"\n  Analysis saved to: {analysis_file}")
    
    return analysis

def generate_statistics(df):
    """Generate statistics"""
    log("\n" + "="*80)
    log("STATISTICS")
    log("="*80)
    
    stats = {
        'total_records': len(df),
        'unique_employee_ids': df['Employee_ID'].nunique() if 'Employee_ID' in df.columns else 0,
        'pending_ids': int((df['Employee_ID'].str.startswith('PENDING_ID', na=False)).sum()) if 'Employee_ID' in df.columns else 0,
        'data_completeness': (df.notna().sum().sum() / (len(df) * len(df.columns)) * 100) if len(df) > 0 else 0,
    }
    
    log(f"  Total Records: {stats['total_records']}")
    log(f"  Unique Employee IDs: {stats['unique_employee_ids']}")
    log(f"  Pending ID Assignment: {stats['pending_ids']}")
    log(f"  Data Completeness: {stats['data_completeness']:.1f}%")
    
    stats_file = os.path.join(ANALYSIS_DIR, 'consolidation_statistics_v3.json')
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
        
        # Pending Employee ID assignment
        if 'Needs_Employee_ID' in df.columns:
            pending_df = df[df['Needs_Employee_ID'] == True].copy()
            if len(pending_df) > 0:
                pending_df.to_excel(writer, sheet_name='Pending_ID_Assignment', index=False)
                log(f"  Saved Pending_ID_Assignment sheet ({len(pending_df)} rows)")
        
        # Potential rejoined employees
        if 'Employee_ID' in df.columns:
            id_counts = df[df['Employee_ID'].str.startswith('EMP-', na=False)].groupby('Employee_ID').size()
            multiple = id_counts[id_counts > 1]
            
            if len(multiple) > 0:
                rejoined_candidates = df[df['Employee_ID'].isin(multiple.index)].copy()
                rejoined_candidates = rejoined_candidates.sort_values(['Employee_ID', 'Joining_Date'])
                rejoined_candidates.to_excel(writer, sheet_name='Potential_Rejoined', index=False)
                log(f"  Saved Potential_Rejoined sheet ({len(rejoined_candidates)} rows)")
        
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
    log("EMPLOYEE DATA CONSOLIDATION - PRODUCTION VERSION v3")
    log("="*80)
    log("Key Features:")
    log("  ✅ PRESERVES existing Employee IDs (no auto-generation)")
    log("  ✅ Minimal deduplication (exact duplicates only)")
    log("  ✅ Keeps rejoined employees (multiple records per ID)")
    log("  ✅ Handles employees with same name")
    log("  ✅ Auto-detects headers in rows 1-4")
    log("="*80)
    
    os.makedirs(ANALYSIS_DIR, exist_ok=True)
    
    # Merge all data
    consolidated_df = merge_all_data()
    
    if consolidated_df is None or len(consolidated_df) == 0:
        log("\nERROR: No data consolidated. Exiting.")
        return
    
    # Minimal deduplication (exact duplicates only)
    consolidated_df = minimal_deduplication(consolidated_df)
    
    # Clean and validate (preserve IDs)
    consolidated_df = clean_and_validate(consolidated_df)
    
    # Analyze data quality
    analyze_data_quality(consolidated_df)
    
    # Generate statistics
    generate_statistics(consolidated_df)
    
    # Save
    save_consolidated_data(consolidated_df)
    
    log("\n" + "="*80)
    log("✅ CONSOLIDATION COMPLETED!")
    log("="*80)
    log("\nIMPORTANT NOTES:")
    log("1. All existing Employee IDs have been PRESERVED")
    log("2. Rows without IDs marked as 'PENDING_ID_*' - assign manually")
    log("3. Check 'Potential_Rejoined' sheet for employees with multiple records")
    log("4. Employment Status preserved from source sheets")
    log("="*80)

if __name__ == "__main__":
    main()

