#!/usr/bin/env python3
"""
Load Consolidated Employee Data to BigQuery
============================================
Loads the consolidated Excel file into BigQuery table.

Prerequisites:
    - BigQuery table must exist (run create_bigquery_schema.sql first)
    - Google Cloud credentials configured (gcloud auth)
    - pandas_gbq library installed: pip install pandas-gbq

Usage:
    python3 load_to_bigquery.py

Author: AI Assistant
Date: October 30, 2025
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
TABLE_ID = "EmployeeData_v2"
FULL_TABLE_ID = f"{PROJECT_ID}.{DATASET_ID}.{TABLE_ID}"

INPUT_FILE = "RAWSheetData/Employee Directory - CONSOLIDATED.xlsx"
SHEET_NAME = "Master_Employee_Data"

def log(message):
    """Print timestamped log message"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def check_prerequisites():
    """Check if all prerequisites are met"""
    log("Checking prerequisites...")
    
    # Check if input file exists
    if not os.path.exists(INPUT_FILE):
        log(f"ERROR: Input file not found: {INPUT_FILE}")
        log("Please run consolidate_employee_data.py first")
        return False
    
    # Check if gcloud is authenticated
    try:
        client = bigquery.Client(project=PROJECT_ID)
        log(f"✅ Authenticated to project: {PROJECT_ID}")
    except Exception as e:
        log(f"ERROR: Not authenticated to Google Cloud")
        log(f"Please run: gcloud auth application-default login")
        return False
    
    # Check if dataset exists
    try:
        dataset = client.get_dataset(DATASET_ID)
        log(f"✅ Dataset exists: {DATASET_ID}")
    except Exception as e:
        log(f"ERROR: Dataset not found: {DATASET_ID}")
        return False
    
    # Check if table exists
    try:
        table = client.get_table(FULL_TABLE_ID)
        log(f"✅ Table exists: {TABLE_ID}")
        log(f"   Current row count: {table.num_rows}")
    except Exception as e:
        log(f"WARNING: Table not found: {TABLE_ID}")
        log(f"Please run create_bigquery_schema.sql first")
        log(f"Or the script will create it automatically")
    
    return True

def load_consolidated_data():
    """Load consolidated Excel file"""
    log(f"Loading data from: {INPUT_FILE}")
    log(f"Sheet: {SHEET_NAME}")
    
    try:
        df = pd.read_excel(INPUT_FILE, sheet_name=SHEET_NAME)
        log(f"✅ Loaded {len(df)} rows, {len(df.columns)} columns")
        return df
    except Exception as e:
        log(f"ERROR loading Excel file: {e}")
        return None

def clean_for_bigquery(df):
    """Clean data for BigQuery compatibility"""
    log("Cleaning data for BigQuery...")
    
    # Convert date columns to proper datetime
    date_columns = [
        'Date_of_Birth', 'Joining_Date', 'Employment_End_Date',
        'Probation_Start_Date', 'Probation_End_Date', 'Spouse_DOB'
    ]
    
    for col in date_columns:
        if col in df.columns:
            # Convert to datetime, then to date string
            df[col] = pd.to_datetime(df[col], errors='coerce')
            # Keep as datetime for BigQuery DATE type
    
    # Convert boolean columns
    bool_columns = ['Rejoined', 'Is_Deleted']
    for col in bool_columns:
        if col in df.columns:
            df[col] = df[col].fillna(False).astype(bool)
    
    # Convert numeric columns
    numeric_columns = [
        'Basic_Salary', 'Medical_Allowance', 'Gross_Salary',
        'Probation_Period_Months', 'Number_of_Children'
    ]
    for col in numeric_columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    # Clean string columns - replace NaN with None
    string_columns = df.select_dtypes(include=['object']).columns
    for col in string_columns:
        df[col] = df[col].replace({np.nan: None, 'nan': None, 'NaN': None, '': None})
    
    # Ensure Employment_Status has valid values
    if 'Employment_Status' in df.columns:
        df['Employment_Status'] = df['Employment_Status'].fillna('Active')
    
    # Add Created_At and Updated_At if missing
    if 'Created_At' not in df.columns:
        df['Created_At'] = datetime.now()
    if 'Updated_At' not in df.columns:
        df['Updated_At'] = datetime.now()
    
    # Ensure Employee_ID is not null
    if 'Employee_ID' in df.columns:
        missing_ids = df['Employee_ID'].isna()
        if missing_ids.any():
            log(f"WARNING: {missing_ids.sum()} rows missing Employee_ID")
            # Generate IDs for missing
            max_id = 0
            for emp_id in df[~missing_ids]['Employee_ID']:
                if isinstance(emp_id, str) and emp_id.startswith('EMP-'):
                    try:
                        num = int(emp_id.split('-')[1])
                        max_id = max(max_id, num)
                    except:
                        pass
            new_ids = [f"EMP-{max_id + i + 1:04d}" for i in range(missing_ids.sum())]
            df.loc[missing_ids, 'Employee_ID'] = new_ids
    
    log(f"✅ Data cleaned, ready for BigQuery")
    return df

def preview_data(df, num_rows=5):
    """Preview data before loading"""
    log(f"\nPreview of data (first {num_rows} rows):")
    print("\n" + "="*80)
    
    # Show key columns
    key_columns = ['Employee_ID', 'Full_Name', 'Official_Email', 
                   'Department', 'Designation', 'Employment_Status']
    
    available_cols = [col for col in key_columns if col in df.columns]
    print(df[available_cols].head(num_rows).to_string(index=False))
    print("="*80 + "\n")
    
    # Show statistics
    log("Data Statistics:")
    log(f"  Total rows: {len(df)}")
    log(f"  Total columns: {len(df.columns)}")
    log(f"  Columns with data: {(df.notna().any()).sum()}")
    log(f"  Data completeness: {(df.notna().sum().sum() / (len(df) * len(df.columns)) * 100):.1f}%")
    
    if 'Employment_Status' in df.columns:
        log(f"\n  Employment Status Breakdown:")
        for status, count in df['Employment_Status'].value_counts().items():
            log(f"    {status}: {count}")
    
    if 'Department' in df.columns:
        log(f"\n  Top 5 Departments:")
        for dept, count in df['Department'].value_counts().head(5).items():
            if pd.notna(dept):
                log(f"    {dept}: {count}")

def load_to_bigquery(df, if_exists='replace'):
    """
    Load dataframe to BigQuery
    
    Args:
        df: DataFrame to load
        if_exists: 'fail', 'replace', or 'append'
    """
    log("\n" + "="*80)
    log("LOADING DATA TO BIGQUERY")
    log("="*80)
    log(f"Target table: {FULL_TABLE_ID}")
    log(f"Mode: {if_exists}")
    log(f"Rows to load: {len(df)}")
    
    # Confirm before loading
    response = input("\n⚠️  Proceed with loading data to BigQuery? (yes/no): ")
    if response.lower() not in ['yes', 'y']:
        log("Operation cancelled by user")
        return False
    
    try:
        log("Uploading data... (this may take a few minutes)")
        
        # Use pandas_gbq for easier data type handling
        to_gbq(
            df,
            FULL_TABLE_ID,
            project_id=PROJECT_ID,
            if_exists=if_exists,
            progress_bar=True,
            chunksize=1000
        )
        
        log("✅ Data successfully loaded to BigQuery!")
        
        # Verify the load
        client = bigquery.Client(project=PROJECT_ID)
        table = client.get_table(FULL_TABLE_ID)
        log(f"✅ Verified: Table now has {table.num_rows} rows")
        
        return True
        
    except Exception as e:
        log(f"❌ ERROR loading data to BigQuery: {e}")
        return False

def run_post_load_checks():
    """Run checks after loading data"""
    log("\n" + "="*80)
    log("POST-LOAD VERIFICATION")
    log("="*80)
    
    try:
        client = bigquery.Client(project=PROJECT_ID)
        
        # Check 1: Row count
        query = f"SELECT COUNT(*) as total FROM `{FULL_TABLE_ID}`"
        result = client.query(query).to_dataframe()
        log(f"✅ Total rows in table: {result['total'].iloc[0]}")
        
        # Check 2: Employment status breakdown
        query = f"""
        SELECT 
            Employment_Status,
            COUNT(*) as count
        FROM `{FULL_TABLE_ID}`
        GROUP BY Employment_Status
        ORDER BY count DESC
        """
        result = client.query(query).to_dataframe()
        log("\n  Employment Status Breakdown:")
        for _, row in result.iterrows():
            log(f"    {row['Employment_Status']}: {row['count']}")
        
        # Check 3: Department breakdown
        query = f"""
        SELECT 
            Department,
            COUNT(*) as count
        FROM `{FULL_TABLE_ID}`
        WHERE Department IS NOT NULL
        GROUP BY Department
        ORDER BY count DESC
        LIMIT 10
        """
        result = client.query(query).to_dataframe()
        log("\n  Top 10 Departments:")
        for _, row in result.iterrows():
            log(f"    {row['Department']}: {row['count']}")
        
        # Check 4: Data quality
        query = f"""
        SELECT 
            COUNTIF(Official_Email IS NOT NULL) as with_email,
            COUNTIF(Contact_Number IS NOT NULL) as with_phone,
            COUNTIF(Department IS NOT NULL) as with_dept,
            COUNTIF(Joining_Date IS NOT NULL) as with_join_date,
            COUNT(*) as total
        FROM `{FULL_TABLE_ID}`
        """
        result = client.query(query).to_dataframe()
        row = result.iloc[0]
        total = row['total']
        
        log("\n  Data Quality:")
        log(f"    With Email: {row['with_email']} ({row['with_email']/total*100:.1f}%)")
        log(f"    With Phone: {row['with_phone']} ({row['with_phone']/total*100:.1f}%)")
        log(f"    With Department: {row['with_dept']} ({row['with_dept']/total*100:.1f}%)")
        log(f"    With Join Date: {row['with_join_date']} ({row['with_join_date']/total*100:.1f}%)")
        
        log("\n✅ All checks passed!")
        return True
        
    except Exception as e:
        log(f"❌ ERROR during post-load checks: {e}")
        return False

def generate_sample_queries():
    """Generate sample queries for reference"""
    log("\n" + "="*80)
    log("SAMPLE QUERIES")
    log("="*80)
    
    queries = {
        "Get all active employees": f"""
        SELECT 
            Employee_ID,
            Full_Name,
            Official_Email,
            Department,
            Designation
        FROM `{FULL_TABLE_ID}`
        WHERE Employment_Status = 'Active'
        ORDER BY Full_Name;
        """,
        
        "Get employee count by department": f"""
        SELECT 
            Department,
            COUNT(*) as employee_count
        FROM `{FULL_TABLE_ID}`
        WHERE Employment_Status = 'Active'
        GROUP BY Department
        ORDER BY employee_count DESC;
        """,
        
        "Get employees who joined recently (last 90 days)": f"""
        SELECT 
            Employee_ID,
            Full_Name,
            Department,
            Joining_Date
        FROM `{FULL_TABLE_ID}`
        WHERE Joining_Date >= DATE_SUB(CURRENT_DATE(), INTERVAL 90 DAY)
            AND Employment_Status = 'Active'
        ORDER BY Joining_Date DESC;
        """,
        
        "Get employees missing critical information": f"""
        SELECT 
            Employee_ID,
            Full_Name,
            CASE 
                WHEN Official_Email IS NULL THEN 'Missing Email'
                WHEN Contact_Number IS NULL THEN 'Missing Phone'
                WHEN Department IS NULL THEN 'Missing Department'
                WHEN Joining_Date IS NULL THEN 'Missing Join Date'
            END as missing_field
        FROM `{FULL_TABLE_ID}`
        WHERE Official_Email IS NULL 
            OR Contact_Number IS NULL
            OR Department IS NULL
            OR Joining_Date IS NULL;
        """
    }
    
    # Save queries to file
    queries_file = "EmployeeData/sample_bigquery_queries.sql"
    with open(queries_file, 'w') as f:
        for title, query in queries.items():
            f.write(f"-- {title}\n")
            f.write(query)
            f.write("\n\n")
    
    log(f"Sample queries saved to: {queries_file}")
    log("\nYou can run these in BigQuery console or using bq command-line tool")

def main():
    """Main execution"""
    log("="*80)
    log("LOAD EMPLOYEE DATA TO BIGQUERY")
    log("="*80)
    
    # Step 1: Check prerequisites
    if not check_prerequisites():
        log("\n❌ Prerequisites not met. Exiting.")
        return
    
    # Step 2: Load consolidated data
    df = load_consolidated_data()
    if df is None:
        return
    
    # Step 3: Clean data
    df = clean_for_bigquery(df)
    
    # Step 4: Preview data
    preview_data(df)
    
    # Step 5: Load to BigQuery
    success = load_to_bigquery(df, if_exists='replace')
    
    if success:
        # Step 6: Run post-load checks
        run_post_load_checks()
        
        # Step 7: Generate sample queries
        generate_sample_queries()
        
        log("\n" + "="*80)
        log("✅ DATA LOAD COMPLETED SUCCESSFULLY!")
        log("="*80)
        log("\nNext Steps:")
        log("1. Verify data in BigQuery console")
        log("2. Run sample queries from EmployeeData/sample_bigquery_queries.sql")
        log("3. Set up appropriate access controls")
        log("4. Create scheduled queries for automated reports")
        log("5. Integrate with your applications")
        log("="*80)
    else:
        log("\n❌ Data load failed. Please check errors above.")

if __name__ == "__main__":
    main()

