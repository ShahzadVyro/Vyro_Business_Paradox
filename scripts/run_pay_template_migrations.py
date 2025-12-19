#!/usr/bin/env python3
"""
Run Pay Template Database Migrations
=====================================
Executes SQL migrations for Pay Template feature:
1. Add Probation_Status column to Employees table
2. Add approval columns to Pay_Template_Confirmations table

Prerequisites:
    - Google Cloud credentials configured (gcloud auth)
    - google-cloud-bigquery library installed: pip install google-cloud-bigquery

Usage:
    python3 scripts/run_pay_template_migrations.py

Author: AI Assistant
Date: December 2025
"""

import sys
import os
from pathlib import Path

# Add parent directory to path to import from project root
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

try:
    from google.cloud import bigquery
except ImportError:
    print("ERROR: Required library not installed")
    print("Please run: pip install google-cloud-bigquery")
    sys.exit(1)

# Configuration
PROJECT_ID = "test-imagine-web"
DATASET_ID = "Vyro_Business_Paradox"

def log(message):
    """Print timestamped log message"""
    from datetime import datetime
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def execute_sql_file(client, sql_file_path, skip_if_exists=False):
    """Execute SQL file against BigQuery"""
    log(f"Reading SQL file: {sql_file_path}")
    
    if not os.path.exists(sql_file_path):
        log(f"ERROR: SQL file not found: {sql_file_path}")
        return False
    
    with open(sql_file_path, 'r') as f:
        sql = f.read()
    
    # For CREATE TABLE IF NOT EXISTS, we can execute as-is
    # For ALTER TABLE, we need to handle errors gracefully
    try:
        log(f"Executing SQL from {sql_file_path}...")
        query_job = client.query(sql)
        results = query_job.result()  # Wait for the job to complete
        
        log(f"✅ Successfully executed: {sql_file_path}")
        if hasattr(results, 'total_rows') and results.total_rows:
            log(f"   Rows affected: {results.total_rows}")
        return True
    except Exception as e:
        error_msg = str(e)
        # Check if it's a "table already exists" or "column already exists" error
        if skip_if_exists and ("already exists" in error_msg.lower() or "duplicate" in error_msg.lower()):
            log(f"⚠️  Table/column already exists, skipping: {sql_file_path}")
            return True
        # Check if it's a "column already exists" error for ALTER TABLE
        if "already exists" in error_msg.lower() or "duplicate column" in error_msg.lower():
            log(f"⚠️  Column already exists, skipping: {sql_file_path}")
            return True
        log(f"❌ Error executing {sql_file_path}: {error_msg}")
        return False

def main():
    """Main execution"""
    log("="*80)
    log("PAY TEMPLATE DATABASE MIGRATIONS")
    log("="*80)
    
    # Initialize BigQuery client
    try:
        client = bigquery.Client(project=PROJECT_ID)
        log(f"✅ Connected to BigQuery project: {PROJECT_ID}")
    except Exception as e:
        log(f"ERROR: Failed to connect to BigQuery: {str(e)}")
        log("Please ensure you're authenticated: gcloud auth application-default login")
        return
    
    # SQL files to execute
    migrations = [
        {
            "name": "Create Pay_Template_Confirmations table (if not exists)",
            "file": project_root / "database" / "create_pay_template_tables.sql",
            "skip_if_exists": True
        },
        {
            "name": "Add Probation_Status to Employees",
            "file": project_root / "database" / "add_probation_status_column.sql"
        },
        {
            "name": "Add approval columns to Pay_Template_Confirmations",
            "file": project_root / "database" / "update_pay_template_confirmations_table.sql"
        }
    ]
    
    success_count = 0
    failed_count = 0
    
    for migration in migrations:
        log(f"\n--- {migration['name']} ---")
        skip_if_exists = migration.get('skip_if_exists', False)
        if execute_sql_file(client, migration['file'], skip_if_exists=skip_if_exists):
            success_count += 1
        else:
            failed_count += 1
    
    log("\n" + "="*80)
    log("MIGRATION SUMMARY")
    log("="*80)
    log(f"✅ Successful: {success_count}")
    log(f"❌ Failed: {failed_count}")
    
    if failed_count == 0:
        log("\n✅ All migrations completed successfully!")
        log("\nNext Steps:")
        log("1. Verify schema changes in BigQuery console")
        log("2. Test the Pay Template features in the application")
        log("3. Verify that new hires, leavers, and confirmations auto-populate")
    else:
        log("\n⚠️  Some migrations failed. Please review errors above.")
    
    log("="*80)

if __name__ == "__main__":
    main()
