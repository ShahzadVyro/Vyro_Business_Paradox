#!/usr/bin/env python3
"""
Run Probation Columns Migration
================================
Adds Probation_Period_Months and Probation_Start_Date columns to Employees table.

Usage:
    python3 scripts/run_probation_columns_migration.py
"""

import sys
import os
from pathlib import Path
from google.cloud import bigquery
from google.oauth2 import service_account

# Add parent directory to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Configuration
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "test-imagine-web")
DATASET_ID = os.getenv("BQ_DATASET", "Vyro_Business_Paradox")

def get_bigquery_client():
    """Initialize BigQuery client"""
    credentials_path = project_root / "Credentials" / "serviceAccountKey.json"
    
    if credentials_path.exists():
        credentials = service_account.Credentials.from_service_account_file(
            str(credentials_path),
            scopes=["https://www.googleapis.com/auth/bigquery"]
        )
        return bigquery.Client(credentials=credentials, project=PROJECT_ID)
    else:
        return bigquery.Client(project=PROJECT_ID)

def log(message):
    """Print timestamped log message"""
    from datetime import datetime
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def check_column_exists(client, column_name):
    """Check if a column exists in Employees table"""
    try:
        query = f"""
        SELECT column_name
        FROM `{PROJECT_ID}.{DATASET_ID}.INFORMATION_SCHEMA.COLUMNS`
        WHERE table_name = @table_name
          AND column_name = @column_name
        """
        results = client.query(query, job_config=bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("table_name", "STRING", "Employees"),
                bigquery.ScalarQueryParameter("column_name", "STRING", column_name),
            ]
        )).result()
        return len(list(results)) > 0
    except Exception:
        return False

def execute_sql_file(client, sql_file_path):
    """Execute SQL file against BigQuery"""
    log(f"Reading SQL file: {sql_file_path}")
    
    if not os.path.exists(sql_file_path):
        log(f"ERROR: SQL file not found: {sql_file_path}")
        return False
    
    with open(sql_file_path, 'r') as f:
        sql_content = f.read()
    
    # Remove comments and split by semicolon
    lines = sql_content.split('\n')
    cleaned_lines = []
    for line in lines:
        # Remove inline comments
        if '--' in line:
            line = line[:line.index('--')]
        cleaned_lines.append(line.strip())
    
    # Join and split by semicolon
    full_sql = ' '.join(cleaned_lines)
    statements = [s.strip() for s in full_sql.split(';') if s.strip()]
    
    log(f"Found {len(statements)} SQL statement(s) to execute")
    
    success_count = 0
    for i, statement in enumerate(statements, 1):
        if not statement:
            continue
        
        # Extract column name from statement for checking
        column_name = None
        if 'Probation_Period_Months' in statement:
            column_name = 'Probation_Period_Months'
        elif 'Probation_Start_Date' in statement:
            column_name = 'Probation_Start_Date'
        
        # Check if column already exists
        if column_name and check_column_exists(client, column_name):
            log(f"⚠️  Column {column_name} already exists, skipping")
            success_count += 1
            continue
        
        try:
            log(f"Executing statement {i}/{len(statements)}: {statement[:100]}...")
            query_job = client.query(statement)
            query_job.result()  # Wait for completion
            log(f"✅ Statement {i} successfully executed")
            success_count += 1
        except Exception as e:
            error_msg = str(e)
            # Check if it's a "column already exists" error
            if "already exists" in error_msg.lower() or "duplicate column" in error_msg.lower():
                log(f"⚠️  Column already exists, skipping")
                success_count += 1
                continue
            log(f"❌ Error: {error_msg}")
            return False
    
    return success_count > 0

def main():
    """Main function"""
    log("="*80)
    log("Probation Columns Migration")
    log("="*80)
    log(f"Project: {PROJECT_ID}")
    log(f"Dataset: {DATASET_ID}")
    log("")
    
    client = get_bigquery_client()
    
    sql_file = project_root / "database" / "add_probation_columns.sql"
    
    if execute_sql_file(client, sql_file):
        log("")
        log("="*80)
        log("Migration Complete!")
        log("="*80)
        log("You can now run: python3 scripts/migrate_employment_and_probation_dates.py")
    else:
        log("")
        log("="*80)
        log("Migration Failed!")
        log("="*80)
        sys.exit(1)

if __name__ == "__main__":
    main()
