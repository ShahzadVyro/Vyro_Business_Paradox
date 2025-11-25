#!/usr/bin/env python3
"""
Employee Data Consolidation Script
===================================
Consolidates fragmented employee data from multiple Excel sheets into a single clean master sheet.

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
OUTPUT_FILE = 'RAWSheetData/Employee Directory - CONSOLIDATED.xlsx'
ANALYSIS_DIR = 'EmployeeData'

# Field mapping to standardize column names across sheets
FIELD_MAPPING = {
    # Different variations of the same field
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
}

def log(message):
    """Print timestamped log message"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def clean_phone_number(value):
    """Clean and standardize phone numbers"""
    if pd.isna(value):
        return None
    # Convert to string and remove any non-numeric characters except +
    value_str = str(value)
    if value_str.lower() in ['nan', 'none', '', 'nat']:
        return None
    # Remove common formatting
    cleaned = ''.join(c for c in value_str if c.isdigit() or c == '+')
    return cleaned if cleaned else None

def clean_date(value):
    """Clean and standardize dates"""
    if pd.isna(value):
        return None
    try:
        if isinstance(value, (datetime, pd.Timestamp)):
            return value.date()
        # Try parsing as string
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

def standardize_columns(df, sheet_name):
    """Standardize column names using field mapping"""
    log(f"  Standardizing columns for {sheet_name}")
    
    # Rename columns based on mapping
    df.columns = df.columns.str.strip()  # Remove leading/trailing spaces
    df = df.rename(columns=FIELD_MAPPING)
    
    return df

def load_employees_data_sheet():
    """Load and clean 'Employees Data' sheet - this has the best structure"""
    log("Loading 'Employees Data' sheet...")
    df = pd.read_excel(INPUT_FILE, sheet_name='Employees Data')
    df = standardize_columns(df, 'Employees Data')
    
    # Filter out completely empty rows
    df = df.dropna(how='all')
    
    log(f"  Found {len(df)} rows")
    return df

def load_employee_information_sheet():
    """Load and clean 'Employee_Information' sheet - form submissions"""
    log("Loading 'Employee_Information' sheet...")
    df = pd.read_excel(INPUT_FILE, sheet_name='Employee_Information')
    df = standardize_columns(df, 'Employee_Information')
    
    # Filter out completely empty rows
    df = df.dropna(how='all')
    
    # Add employment status if not present
    if 'Employment_Status' not in df.columns:
        df['Employment_Status'] = 'Active'  # Assume form submissions are for active employees
    
    log(f"  Found {len(df)} rows")
    return df

def load_slack_mapping():
    """Load Slack ID mapping"""
    log("Loading 'Slack_Map_ID' sheet...")
    try:
        df = pd.read_excel(INPUT_FILE, sheet_name='Slack_Map_ID')
        # Standardize column names
        df.columns = ['Email', 'Full_Name', 'Slack_ID']
        df['Email'] = df['Email'].apply(clean_email)
        log(f"  Found {len(df)} Slack mappings")
        return df
    except Exception as e:
        log(f"  Warning: Could not load Slack mapping: {e}")
        return pd.DataFrame(columns=['Email', 'Full_Name', 'Slack_ID'])

def infer_active_sheet_structure():
    """
    Try to infer structure of 'Active' sheet by looking at first few rows
    This sheet has no headers (all columns are "Unnamed: X")
    """
    log("Analyzing 'Active' sheet structure...")
    
    # Read first 10 rows to understand structure
    df = pd.read_excel(INPUT_FILE, sheet_name='Active', nrows=10)
    
    log(f"  Active sheet has {len(df.columns)} columns")
    log(f"  First few column names: {list(df.columns)[:10]}")
    
    # Check if first row might be headers
    first_row = df.iloc[0]
    log(f"  First row values: {first_row[:10].tolist()}")
    
    # If first row contains strings that look like headers, use it
    if first_row[0] and isinstance(first_row[0], str):
        log("  First row appears to be headers")
        # Re-read with first row as headers
        df = pd.read_excel(INPUT_FILE, sheet_name='Active', header=0)
    else:
        log("  WARNING: Cannot infer structure - Active sheet has no clear headers")
        log("  Will skip Active sheet for now")
        return None
    
    return df

def infer_resigned_terminated_structure():
    """
    Try to infer structure of 'ResignedTerminated' sheet
    This sheet also has no headers (all columns are "Unnamed: X")
    """
    log("Analyzing 'ResignedTerminated' sheet structure...")
    
    # Read first 10 rows to understand structure
    df = pd.read_excel(INPUT_FILE, sheet_name='ResignedTerminated', nrows=10)
    
    log(f"  ResignedTerminated sheet has {len(df.columns)} columns")
    log(f"  First few column names: {list(df.columns)[:10]}")
    
    # Check if first row might be headers
    first_row = df.iloc[0]
    log(f"  First row values: {first_row[:10].tolist()}")
    
    # If first row contains strings that look like headers, use it
    if first_row[0] and isinstance(first_row[0], str):
        log("  First row appears to be headers")
        # Re-read with first row as headers
        df = pd.read_excel(INPUT_FILE, sheet_name='ResignedTerminated', header=0)
        df['Employment_Status'] = 'Resigned/Terminated'
    else:
        log("  WARNING: Cannot infer structure - ResignedTerminated sheet has no clear headers")
        log("  Will skip ResignedTerminated sheet for now")
        return None
    
    return df

def merge_all_data():
    """Merge data from all relevant sheets"""
    log("\n" + "="*80)
    log("MERGING ALL EMPLOYEE DATA")
    log("="*80)
    
    all_dataframes = []
    
    # Load main sheets
    try:
        df_employees = load_employees_data_sheet()
        if df_employees is not None and len(df_employees) > 0:
            all_dataframes.append(df_employees)
    except Exception as e:
        log(f"  Error loading Employees Data: {e}")
    
    try:
        df_empl_info = load_employee_information_sheet()
        if df_empl_info is not None and len(df_empl_info) > 0:
            all_dataframes.append(df_empl_info)
    except Exception as e:
        log(f"  Error loading Employee Information: {e}")
    
    # Try to load Active and ResignedTerminated sheets
    try:
        df_active = infer_active_sheet_structure()
        if df_active is not None and len(df_active) > 0:
            df_active = standardize_columns(df_active, 'Active')
            df_active['Employment_Status'] = 'Active'
            all_dataframes.append(df_active)
    except Exception as e:
        log(f"  Error loading Active sheet: {e}")
    
    try:
        df_resigned = infer_resigned_terminated_structure()
        if df_resigned is not None and len(df_resigned) > 0:
            df_resigned = standardize_columns(df_resigned, 'ResignedTerminated')
            all_dataframes.append(df_resigned)
    except Exception as e:
        log(f"  Error loading ResignedTerminated sheet: {e}")
    
    if not all_dataframes:
        log("ERROR: No data could be loaded from any sheet!")
        return None
    
    # Combine all dataframes
    log(f"\nCombining {len(all_dataframes)} data sources...")
    combined_df = pd.concat(all_dataframes, ignore_index=True, sort=False)
    
    log(f"Total rows after combining: {len(combined_df)}")
    
    return combined_df

def deduplicate_employees(df):
    """Remove duplicate employees"""
    log("\n" + "="*80)
    log("DEDUPLICATION")
    log("="*80)
    
    initial_count = len(df)
    log(f"Initial row count: {initial_count}")
    
    # Strategy: Keep the most recent/complete record for each employee
    # Identify duplicates by email or ID
    
    # First, try to deduplicate by Official Email
    if 'Official_Email' in df.columns:
        df['Official_Email'] = df['Official_Email'].apply(clean_email)
        email_duplicates = df['Official_Email'].notna() & df['Official_Email'].duplicated(keep=False)
        log(f"  Found {email_duplicates.sum()} rows with duplicate official emails")
        
        # Keep the row with most non-null values for each email
        df = df.sort_values('Official_Email').drop_duplicates(subset=['Official_Email'], keep='first')
    
    # Then deduplicate by National ID
    if 'National_ID' in df.columns:
        # Convert to string for consistent sorting
        df['National_ID'] = df['National_ID'].astype(str).replace('nan', None)
        id_duplicates = df['National_ID'].notna() & df['National_ID'].duplicated(keep=False)
        log(f"  Found {id_duplicates.sum()} rows with duplicate National IDs")
        
        # Sort and deduplicate
        df_sorted = df.sort_values('National_ID', na_position='last')
        df = df_sorted.drop_duplicates(subset=['National_ID'], keep='first')
    
    # Finally deduplicate by Full Name (less reliable)
    if 'Full_Name' in df.columns:
        # Convert to string for consistent sorting
        df['Full_Name'] = df['Full_Name'].astype(str).replace('nan', None)
        name_duplicates = df['Full_Name'].notna() & df['Full_Name'].duplicated(keep=False)
        log(f"  Found {name_duplicates.sum()} rows with duplicate names")
        
        # Sort and deduplicate
        df_sorted = df.sort_values('Full_Name', na_position='last')
        df = df_sorted.drop_duplicates(subset=['Full_Name'], keep='first')
    
    final_count = len(df)
    removed = initial_count - final_count
    log(f"Final row count: {final_count}")
    log(f"Removed {removed} duplicate rows ({removed/initial_count*100:.1f}%)")
    
    return df

def clean_and_validate(df):
    """Clean and validate data"""
    log("\n" + "="*80)
    log("DATA CLEANING")
    log("="*80)
    
    # Clean phone numbers
    if 'Contact_Number' in df.columns:
        df['Contact_Number'] = df['Contact_Number'].apply(clean_phone_number)
    
    if 'Emergency_Contact_Number' in df.columns:
        df['Emergency_Contact_Number'] = df['Emergency_Contact_Number'].apply(clean_phone_number)
    
    # Clean emails
    if 'Official_Email' in df.columns:
        df['Official_Email'] = df['Official_Email'].apply(clean_email)
    
    if 'Personal_Email' in df.columns:
        df['Personal_Email'] = df['Personal_Email'].apply(clean_email)
    
    # Clean dates
    date_columns = ['Date_of_Birth', 'Joining_Date', 'Employment_End_Date', 
                   'Probation_End_Date', 'Spouse_DOB']
    
    for col in date_columns:
        if col in df.columns:
            df[col] = df[col].apply(clean_date)
    
    # Generate Employee IDs if missing
    if 'Employee_ID' not in df.columns or df['Employee_ID'].isna().any():
        log("  Generating Employee IDs for records without IDs...")
        
        # Create new column if doesn't exist
        if 'Employee_ID' not in df.columns:
            df['Employee_ID'] = None
        
        # Generate IDs for missing values
        missing_ids = df['Employee_ID'].isna()
        num_missing = missing_ids.sum()
        
        if num_missing > 0:
            # Get the highest existing ID number
            existing_ids = df[~missing_ids]['Employee_ID'].astype(str)
            max_id = 0
            for emp_id in existing_ids:
                if isinstance(emp_id, str) and emp_id.startswith('EMP-'):
                    try:
                        num = int(emp_id.split('-')[1])
                        max_id = max(max_id, num)
                    except:
                        pass
            
            # Generate new IDs
            new_ids = [f"EMP-{max_id + i + 1:04d}" for i in range(num_missing)]
            df.loc[missing_ids, 'Employee_ID'] = new_ids
            log(f"  Generated {num_missing} new Employee IDs (starting from EMP-{max_id+1:04d})")
    
    # Add Created_At and Updated_At timestamps
    now = datetime.now()
    df['Created_At'] = now
    df['Updated_At'] = now
    
    log("Data cleaning completed")
    
    return df

def add_slack_ids(df, slack_df):
    """Add Slack IDs to main dataframe"""
    log("\n" + "="*80)
    log("ADDING SLACK IDs")
    log("="*80)
    
    if slack_df is None or len(slack_df) == 0:
        log("  No Slack mapping data available")
        return df
    
    # Merge on email
    if 'Slack_ID' not in df.columns:
        df['Slack_ID'] = None
    
    # Match by Official Email
    for idx, row in df.iterrows():
        email = row.get('Official_Email')
        if pd.notna(email):
            slack_match = slack_df[slack_df['Email'] == email]
            if not slack_match.empty:
                df.at[idx, 'Slack_ID'] = slack_match.iloc[0]['Slack_ID']
    
    matched = df['Slack_ID'].notna().sum()
    log(f"  Matched {matched} employees with Slack IDs")
    
    return df

def generate_statistics(df):
    """Generate statistics about the consolidated data"""
    log("\n" + "="*80)
    log("DATA STATISTICS")
    log("="*80)
    
    stats = {
        'total_employees': len(df),
        'active_employees': len(df[df['Employment_Status'] == 'Active']) if 'Employment_Status' in df.columns else 0,
        'resigned_terminated': len(df[df['Employment_Status'].str.contains('Resigned|Terminated', na=False, case=False)]) if 'Employment_Status' in df.columns else 0,
        'employees_with_email': df['Official_Email'].notna().sum() if 'Official_Email' in df.columns else 0,
        'employees_with_phone': df['Contact_Number'].notna().sum() if 'Contact_Number' in df.columns else 0,
        'employees_with_slack': df['Slack_ID'].notna().sum() if 'Slack_ID' in df.columns else 0,
        'completeness_percentage': (df.notna().sum().sum() / (len(df) * len(df.columns)) * 100) if len(df) > 0 else 0,
        'total_columns': len(df.columns),
        'columns_with_data': (df.notna().any()).sum(),
    }
    
    # Department breakdown
    if 'Department' in df.columns:
        dept_counts = df['Department'].value_counts().to_dict()
        stats['department_breakdown'] = dept_counts
    
    # Print statistics
    log(f"  Total Employees: {stats['total_employees']}")
    log(f"  Active: {stats['active_employees']}")
    log(f"  Resigned/Terminated: {stats['resigned_terminated']}")
    log(f"  With Official Email: {stats['employees_with_email']}")
    log(f"  With Phone Number: {stats['employees_with_phone']}")
    log(f"  With Slack ID: {stats['employees_with_slack']}")
    log(f"  Data Completeness: {stats['completeness_percentage']:.1f}%")
    log(f"  Total Columns: {stats['total_columns']}")
    log(f"  Columns with Data: {stats['columns_with_data']}")
    
    if 'department_breakdown' in stats:
        log("\n  Department Breakdown:")
        for dept, count in sorted(stats['department_breakdown'].items(), key=lambda x: x[1], reverse=True)[:10]:
            if pd.notna(dept):
                log(f"    {dept}: {count}")
    
    # Save statistics to JSON
    stats_file = os.path.join(ANALYSIS_DIR, 'consolidation_statistics.json')
    with open(stats_file, 'w') as f:
        json.dump(stats, f, indent=2, default=str)
    log(f"\n  Statistics saved to: {stats_file}")
    
    return stats

def save_consolidated_data(df):
    """Save consolidated data to new Excel file"""
    log("\n" + "="*80)
    log("SAVING CONSOLIDATED DATA")
    log("="*80)
    
    # Create Excel writer
    with pd.ExcelWriter(OUTPUT_FILE, engine='openpyxl') as writer:
        # Main consolidated sheet
        df.to_excel(writer, sheet_name='Master_Employee_Data', index=False)
        log(f"  Saved Master_Employee_Data sheet ({len(df)} rows)")
        
        # Create separate views
        if 'Employment_Status' in df.columns:
            # Active employees only
            active_df = df[df['Employment_Status'] == 'Active'].copy()
            active_df.to_excel(writer, sheet_name='Active_Employees', index=False)
            log(f"  Saved Active_Employees sheet ({len(active_df)} rows)")
            
            # Resigned/Terminated employees only
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
    log("EMPLOYEE DATA CONSOLIDATION SCRIPT")
    log("="*80)
    log(f"Input File: {INPUT_FILE}")
    log(f"Output File: {OUTPUT_FILE}")
    log(f"Analysis Directory: {ANALYSIS_DIR}")
    log("="*80)
    
    # Create analysis directory if it doesn't exist
    os.makedirs(ANALYSIS_DIR, exist_ok=True)
    
    # Load Slack mapping first
    slack_df = load_slack_mapping()
    
    # Merge all data sources
    consolidated_df = merge_all_data()
    
    if consolidated_df is None or len(consolidated_df) == 0:
        log("\nERROR: No data was consolidated. Exiting.")
        return
    
    # Deduplicate
    consolidated_df = deduplicate_employees(consolidated_df)
    
    # Clean and validate
    consolidated_df = clean_and_validate(consolidated_df)
    
    # Add Slack IDs
    consolidated_df = add_slack_ids(consolidated_df, slack_df)
    
    # Generate statistics
    stats = generate_statistics(consolidated_df)
    
    # Save consolidated data
    save_consolidated_data(consolidated_df)
    
    log("\n" + "="*80)
    log("CONSOLIDATION COMPLETED SUCCESSFULLY!")
    log("="*80)
    log("\nNext Steps:")
    log("1. Review the consolidated file: " + OUTPUT_FILE)
    log("2. Check Data_Quality_Report sheet for completeness")
    log("3. Verify Active_Employees and Former_Employees sheets")
    log("4. Update BigQuery schema based on proposed_schema.json")
    log("5. Load Master_Employee_Data into BigQuery")
    log("="*80)

if __name__ == "__main__":
    main()

