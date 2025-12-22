#!/usr/bin/env python3
"""
Migrate Tax Data from CSV to Employee_Tax_Calculations Table
============================================================
Template for migrating tax calculation data from CSV file.
This is a template - actual implementation depends on tax CSV structure.

Prerequisites:
    - Tax CSV file (to be provided)
    - BigQuery Employee_Tax_Calculations table must exist
    - Employees table must exist (for Employee_ID validation)
    - Google Cloud credentials configured

Usage:
    python3 database/migrations/migrate_tax_data_from_csv.py

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
EMPLOYEES_TABLE = f"{PROJECT_ID}.{DATASET_ID}.Employees"
TARGET_TABLE = f"{PROJECT_ID}.{DATASET_ID}.Employee_Tax_Calculations"

TAX_CSV = "Salaries - Tax 25-26.csv"

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
    """Convert month string to first day of month date"""
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

def migrate_tax_csv():
    """Migrate tax data from CSV"""
    log(f"\nLoading Tax CSV: {TAX_CSV}...")
    
    if not os.path.exists(TAX_CSV):
        log(f"❌ Tax CSV file not found: {TAX_CSV}")
        return None
    
    df = pd.read_csv(TAX_CSV)
    log(f"Loaded {len(df)} rows from CSV")
    
    # Filter out rows without Employee ID
    df = df[df['Employee ID'].notna()]
    log(f"After filtering: {len(df)} valid rows")
    
    # Month mapping for Taxable Income (TI) columns and Tax Amount columns
    # Note: Column names have leading/trailing spaces
    month_mapping = {
        'Jul': {
            'ti_col': ' TI (Jul only) ',
            'tax_col': 'Jul-25',
            'date': datetime(2025, 7, 1).date()
        },
        'Aug': {
            'ti_col': ' TI  (Aug only) ',
            'tax_col': ' August ',
            'date': datetime(2025, 8, 1).date()
        },
        'Sep': {
            'ti_col': ' TI  (Sep only) ',
            'tax_col': ' September ',
            'date': datetime(2025, 9, 1).date()
        },
        'Oct': {
            'ti_col': ' TI  (Oct only) ',
            'tax_col': ' October ',
            'date': datetime(2025, 10, 1).date()
        },
        'Nov': {
            'ti_col': ' TI  (Nov only) ',
            'tax_col': ' November ',
            'date': datetime(2025, 11, 1).date()
        },
        'Dec': {
            'ti_col': ' TI (Dec only) ',
            'tax_col': ' December ',
            'date': datetime(2025, 12, 1).date()
        },
        'Jan': {
            'ti_col': ' TI  (Jan only) ',
            'tax_col': ' January ',
            'date': datetime(2026, 1, 1).date()  # Note: Jan 2026
        },
        'Feb': {
            'ti_col': ' TI (Feb only) ',
            'tax_col': ' February ',
            'date': datetime(2026, 2, 1).date()  # Note: Feb 2026
        },
        'Mar': {
            'ti_col': ' TI (Mar only) ',
            'tax_col': ' March ',
            'date': datetime(2026, 3, 1).date()  # Note: Mar 2026
        },
        'Apr': {
            'ti_col': ' TI (Apr only) ',
            'tax_col': 'April',
            'date': datetime(2026, 4, 1).date()  # Note: Apr 2026
        },
        'May': {
            'ti_col': ' TI (May only) ',
            'tax_col': 'May',
            'date': datetime(2026, 5, 1).date()  # Note: May 2026
        },
        'Jun': {
            'ti_col': ' TI (June only) ',
            'tax_col': 'Jun-25',
            'date': datetime(2025, 6, 1).date()  # Note: Jun 2025 (before Jul)
        }
    }
    
    tax_records = []
    
    for idx, row in df.iterrows():
        employee_id = clean_employee_id(row.get('Employee ID'))
        if employee_id is None:
            continue
        
        # Process each month
        for month_key, month_info in month_mapping.items():
            ti_col = month_info['ti_col']
            tax_col = month_info['tax_col']
            payroll_month = month_info['date']
            
            # Get Taxable Income
            taxable_income = clean_numeric_string(row.get(ti_col))
            
            # Get Tax Amount
            tax_amount = clean_numeric_string(row.get(tax_col))
            
            # Only create record if there's taxable income or tax amount
            if taxable_income is not None or tax_amount is not None:
                # Calculate tax rate if both are available
                tax_rate = None
                if taxable_income is not None and tax_amount is not None and taxable_income > 0:
                    tax_rate = (tax_amount / taxable_income) * 100
                
                # Determine tax type (typically Withholding Tax)
                tax_type = 'Withholding'
                
                # Determine tax bracket (can be enhanced based on tax rules)
                tax_bracket = None
                if taxable_income is not None:
                    if taxable_income <= 600000:
                        tax_bracket = '0%'
                    elif taxable_income <= 1200000:
                        tax_bracket = '2.5%'
                    elif taxable_income <= 2400000:
                        tax_bracket = '12.5%'
                    elif taxable_income <= 3600000:
                        tax_bracket = '22.5%'
                    elif taxable_income <= 6000000:
                        tax_bracket = '27.5%'
                    else:
                        tax_bracket = '35%'
                
                record = {
                    'Employee_ID': employee_id,
                    'Payroll_Month': payroll_month,
                    'Taxable_Income': taxable_income,
                    'Tax_Rate': tax_rate,
                    'Tax_Amount': tax_amount,
                    'Tax_Type': tax_type,
                    'Tax_Bracket': tax_bracket,
                    'Calculated_At': datetime.now(),
                    'Comments': None,
                    'Created_At': datetime.now(),
                }
                
                tax_records.append(record)
    
    df_tax = pd.DataFrame(tax_records)
    log(f"Prepared {len(df_tax)} tax records")
    
    return df_tax

def verify_employee_ids(df_tax):
    """Verify all Employee_IDs exist in Employees table"""
    log("\nVerifying Employee_IDs against Employees table...")
    
    client = bigquery.Client(project=PROJECT_ID)
    
    # Get all Employee_IDs from Employees table
    query = f"SELECT DISTINCT Employee_ID FROM `{EMPLOYEES_TABLE}` WHERE Employee_ID IS NOT NULL"
    df_employees = client.query(query).to_dataframe()
    valid_ids = set(df_employees['Employee_ID'].astype(int))
    
    # Check tax Employee_IDs
    if len(df_tax) > 0:
        tax_ids = set(df_tax['Employee_ID'].astype(int))
        invalid_ids = tax_ids - valid_ids
        
        if len(invalid_ids) > 0:
            log(f"⚠️  WARNING: {len(invalid_ids)} Employee_IDs in tax data not found in Employees table")
            log(f"   Invalid IDs: {sorted(list(invalid_ids))[:20]}...")
            df_tax = df_tax[df_tax['Employee_ID'].isin(valid_ids)]
            log(f"   Filtered to {len(df_tax)} valid records")
        else:
            log("✅ All Employee_IDs verified")
    
    return df_tax

def main():
    """Main execution"""
    log("="*80)
    log("MIGRATE TAX DATA FROM CSV TO NORMALIZED TABLE")
    log("="*80)
    
    # Migrate tax data
    df_tax = migrate_tax_csv()
    
    if df_tax is None or len(df_tax) == 0:
        log("❌ No tax data to migrate")
        log("   Please provide tax CSV file and update migrate_tax_csv() function")
        return
    
    # Verify Employee_IDs
    df_tax = verify_employee_ids(df_tax)
    
    if len(df_tax) == 0:
        log("❌ No valid tax records after validation")
        return
    
    # Generate Tax_ID
    df_tax['Tax_ID'] = range(1, len(df_tax) + 1)
    df_tax['Calculated_At'] = datetime.now()
    df_tax['Created_At'] = datetime.now()
    
    # Load to BigQuery
    log(f"\nLoading {len(df_tax)} tax records to {TARGET_TABLE}...")
    
    try:
        to_gbq(
            df_tax,
            TARGET_TABLE,
            project_id=PROJECT_ID,
            if_exists='replace',
            progress_bar=True,
            chunksize=1000
        )
        
        log("✅ Tax data successfully migrated!")
        
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

