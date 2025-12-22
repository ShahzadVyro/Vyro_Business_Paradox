#!/usr/bin/env python3
"""
Migrate OPD Data from CSV to Employee_OPD_Benefits Table
========================================================
Migrates OPD (Out Patient Department) benefits data from CSV file to normalized table.
Handles header rows like "Leavers OPD data", "April Leavers", etc.

Prerequisites:
    - CSV file: Salaries - OPD Data.csv
    - BigQuery Employee_OPD_Benefits table must exist
    - Employees table must exist (for Employee_ID validation)
    - Google Cloud credentials configured

Usage:
    python3 database/migrations/migrate_opd_data_from_csv.py

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
EMPLOYEES_TABLE = f"{PROJECT_ID}.{DATASET_ID}.Employees"
TARGET_TABLE = f"{PROJECT_ID}.{DATASET_ID}.Employee_OPD_Benefits"

OPD_CSV = "Salaries - OPD Data.csv"

# Set credentials path
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'Credentials/test-imagine-web-18d4f9a43aef.json'

def log(message):
    """Print timestamped log message"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def clean_numeric_string(value):
    """Clean numeric strings and convert to float"""
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

def parse_month_to_date(month_str, year=2025):
    """Convert month string (Jan, Feb, etc.) to first day of month date"""
    if pd.isna(month_str) or month_str == '':
        return None
    
    month_map = {
        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6, 'june': 6,
        'jul': 7, 'july': 7, 'aug': 8, 'sep': 9, 'sept': 9, 'oct': 10, 'nov': 11, 'dec': 12
    }
    
    month_lower = str(month_str).lower().strip()
    if month_lower in month_map:
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

def is_header_row(row):
    """Check if row is a header row (contains 'Leavers', 'OPD data', etc.)"""
    if pd.isna(row.get('ID')):
        return True
    
    id_str = str(row.get('ID', '')).lower()
    if any(keyword in id_str for keyword in ['leavers', 'opd data', 'shift in payroll']):
        return True
    
    # Check if Employee Name is missing (header rows don't have names)
    if pd.isna(row.get('Employee Name')) or str(row.get('Employee Name', '')).strip() == '':
        return True
    
    return False

def extract_leaver_month(header_text):
    """Extract month from header text like 'April Leavers', 'May leavers'"""
    if pd.isna(header_text):
        return None
    
    text = str(header_text).lower()
    month_map = {
        'january': 1, 'jan': 1,
        'february': 2, 'feb': 2,
        'march': 3, 'mar': 3,
        'april': 4, 'apr': 4,
        'may': 5,
        'june': 6, 'jun': 6,
        'july': 7, 'jul': 7,
        'august': 8, 'aug': 8,
        'september': 9, 'sep': 9, 'sept': 9,
        'october': 10, 'oct': 10,
        'november': 11, 'nov': 11,
        'december': 12, 'dec': 12
    }
    
    for month_name, month_num in month_map.items():
        if month_name in text:
            return datetime(2025, month_num, 1).date()
    
    return None

def migrate_opd_csv():
    """Migrate OPD data from CSV"""
    log(f"\nLoading OPD CSV: {OPD_CSV}...")
    
    if not os.path.exists(OPD_CSV):
        log(f"❌ CSV file not found: {OPD_CSV}")
        return None
    
    df = pd.read_csv(OPD_CSV)
    log(f"Loaded {len(df)} rows from CSV")
    
    # Filter out header rows and empty rows
    valid_rows = []
    current_leaver_month = None
    
    for idx, row in df.iterrows():
        # Check if this is a header row
        if is_header_row(row):
            # Try to extract leaver month from header
            leaver_month = extract_leaver_month(row.get('ID'))
            if leaver_month:
                current_leaver_month = leaver_month
                log(f"Found leaver header: {row.get('ID')} -> Month: {current_leaver_month}")
            continue
        
        # Check if row has valid Employee ID
        employee_id = clean_employee_id(row.get('ID'))
        if employee_id is None:
            continue
        
        # This is a valid data row
        valid_rows.append({
            'row_index': idx,
            'row_data': row,
            'leaver_month': current_leaver_month
        })
    
    log(f"After filtering: {len(valid_rows)} valid employee rows")
    
    # Process each valid row and create OPD records
    opd_records = []
    
    # Month mapping for CSV columns
    month_columns = {
        'Jan 25': ('Contribution for Jan 25', 'Claimed in Jan 25', datetime(2025, 1, 1).date()),
        'Feb 25': ('Contribution for Feb 25', 'Claimed in Feb 25', datetime(2025, 2, 1).date()),
        'Mar 25': ('Contribution for Mar 25', 'Claimed in Mar 25', datetime(2025, 3, 1).date()),
        'Apr 25': ('Contribution for Apr 25', 'Claimed in Apr 25', datetime(2025, 4, 1).date()),
        'May 25': ('Contribution for May 25', 'Claimed in May 25', datetime(2025, 5, 1).date()),
        'Jun 25': ('Contribution for Jun 25', 'Claimed in Jun 25', datetime(2025, 6, 1).date()),
        'Jul 25': ('Contribution for  Jul 25', 'Claimed in Jul 25', datetime(2025, 7, 1).date()),
        'Aug 25': ('Contribution for Aug 25', 'Claimed in Aug 25', datetime(2025, 8, 1).date()),
        'Sept 25': ('Contribution for Sept 25', 'Claimed in Sept 25', datetime(2025, 9, 1).date()),
        'Oct 25': ('Contribution for Oct 25', 'Claimed in Oct 25', datetime(2025, 10, 1).date()),
        'Nov 25': ('Contribution for Nov 25', 'Claimed in Nov 25', datetime(2025, 11, 1).date()),
        'Dec 25': ('Contribution for Dec 25', 'Claimed in Dec 25', datetime(2025, 12, 1).date()),
    }
    
    for valid_row in valid_rows:
        row = valid_row['row_data']
        employee_id = clean_employee_id(row.get('ID'))
        
        # Process each month
        running_balance = 0
        
        for month_key, (contrib_col, claimed_col, benefit_month) in month_columns.items():
            contribution = clean_numeric_string(row.get(contrib_col))
            claimed = clean_numeric_string(row.get(claimed_col))
            
            # Only create record if there's contribution or claim
            if contribution is not None or claimed is not None:
                # Calculate running balance
                if contribution is not None:
                    running_balance += contribution
                if claimed is not None:
                    running_balance -= claimed
                
                # Determine if employee is active (PKR salaried)
                # Check if employee has PKR salary in Employees table or salary data
                is_active = True  # Default, will be validated later
                
                record = {
                    'Employee_ID': employee_id,
                    'Benefit_Month': benefit_month,
                    'Contribution_Amount': contribution,
                    'Claimed_Amount': claimed,
                    'Balance': running_balance if running_balance != 0 else None,
                    'Currency': 'PKR',
                    'Is_Active': is_active,
                    'Comments': str(row.get('Comments', '')) if pd.notna(row.get('Comments')) else None,
                    'Created_At': datetime.now(),
                    'Updated_At': datetime.now(),
                }
                
                opd_records.append(record)
    
    df_opd = pd.DataFrame(opd_records)
    
    # Generate OPD_ID
    if len(df_opd) > 0:
        df_opd['OPD_ID'] = range(1, len(df_opd) + 1)
    
    log(f"Prepared {len(df_opd)} OPD records")
    
    return df_opd

def verify_employee_ids(df_opd):
    """Verify all Employee_IDs exist in Employees table"""
    log("\nVerifying Employee_IDs against Employees table...")
    
    client = bigquery.Client(project=PROJECT_ID)
    
    # Get all Employee_IDs from Employees table
    query = f"SELECT DISTINCT Employee_ID FROM `{EMPLOYEES_TABLE}` WHERE Employee_ID IS NOT NULL"
    df_employees = client.query(query).to_dataframe()
    valid_ids = set(df_employees['Employee_ID'].astype(int))
    
    # Check OPD Employee_IDs
    if len(df_opd) > 0:
        opd_ids = set(df_opd['Employee_ID'].astype(int))
        invalid_ids = opd_ids - valid_ids
        
        if len(invalid_ids) > 0:
            log(f"⚠️  WARNING: {len(invalid_ids)} Employee_IDs in OPD data not found in Employees table")
            log(f"   Invalid IDs: {sorted(list(invalid_ids))[:20]}...")
            # Filter out invalid IDs
            df_opd = df_opd[df_opd['Employee_ID'].isin(valid_ids)]
            log(f"   Filtered to {len(df_opd)} valid records")
        else:
            log("✅ All Employee_IDs verified")
    
    return df_opd

def main():
    """Main execution"""
    log("="*80)
    log("MIGRATE OPD DATA FROM CSV TO NORMALIZED TABLE")
    log("="*80)
    
    # Migrate OPD data
    df_opd = migrate_opd_csv()
    
    if df_opd is None or len(df_opd) == 0:
        log("❌ No OPD data to migrate")
        return
    
    # Verify Employee_IDs
    df_opd = verify_employee_ids(df_opd)
    
    if len(df_opd) == 0:
        log("❌ No valid OPD records after validation")
        return
    
    # Load to BigQuery
    log(f"\nLoading {len(df_opd)} OPD records to {TARGET_TABLE}...")
    
    try:
        to_gbq(
            df_opd,
            TARGET_TABLE,
            project_id=PROJECT_ID,
            if_exists='replace',
            progress_bar=True,
            chunksize=1000
        )
        
        log("✅ OPD data successfully migrated!")
        
        # Verify
        client = bigquery.Client(project=PROJECT_ID)
        table = client.get_table(TARGET_TABLE)
        log(f"✅ Verified: Table now has {table.num_rows} rows")
        
        # Show summary
        query = f"""
        SELECT 
            COUNT(*) as total_records,
            COUNT(DISTINCT Employee_ID) as unique_employees,
            MIN(Benefit_Month) as min_month,
            MAX(Benefit_Month) as max_month
        FROM `{TARGET_TABLE}`
        """
        df_summary = client.query(query).to_dataframe()
        log("\n" + "="*80)
        log("MIGRATION SUMMARY")
        log("="*80)
        log(f"  Total OPD records: {df_summary.iloc[0]['total_records']}")
        log(f"  Unique employees: {df_summary.iloc[0]['unique_employees']}")
        log(f"  Month range: {df_summary.iloc[0]['min_month']} to {df_summary.iloc[0]['max_month']}")
        log("="*80)
        
    except Exception as e:
        log(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()


