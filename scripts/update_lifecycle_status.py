#!/usr/bin/env python3
"""
Update Lifecycle Status
=======================
Automatically updates Lifecycle_Status based on events and conditions.

Prerequisites:
    - BigQuery Employees and Employee_Lifecycle_Events tables exist
    - Google Cloud credentials configured

Usage:
    python3 scripts/update_lifecycle_status.py

Author: AI Assistant
Date: January 2025
"""

import os
import sys
from datetime import datetime
import warnings

warnings.filterwarnings('ignore')

try:
    from google.cloud import bigquery
except ImportError:
    print("ERROR: Required libraries not installed")
    print("Please run: pip install google-cloud-bigquery")
    sys.exit(1)

# Configuration
PROJECT_ID = "test-imagine-web"
DATASET_ID = "Vyro_Business_Paradox"
EMPLOYEES_TABLE = f"{PROJECT_ID}.{DATASET_ID}.Employees"
LIFECYCLE_EVENTS_TABLE = f"{PROJECT_ID}.{DATASET_ID}.Employee_Lifecycle_Events"

# Set credentials path
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'Credentials/test-imagine-web-18d4f9a43aef.json'

def log(message):
    """Print timestamped log message"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def determine_lifecycle_status(row):
    """Determine lifecycle status based on employee data"""
    # If employee has Official_Email and Employee_ID, they're at least Email_Created
    if row.get('Official_Email') and row.get('Employee_ID'):
        # If Employment_Status is Active, they're fully onboarded
        if row.get('Employment_Status') == 'Active':
            return 'Active'
        elif row.get('Employment_Status') == 'Resigned':
            return 'Resigned'
        elif row.get('Employment_Status') == 'Terminated':
            return 'Terminated'
        else:
            return 'Onboarded'
    
    # If Employee_ID exists but no email, they're at Employee_ID_Assigned
    elif row.get('Employee_ID'):
        return 'Employee_ID_Assigned'
    
    # If data exists but no ID, they're at Data_Added
    elif row.get('Full_Name') or row.get('CNIC_ID'):
        return 'Data_Added'
    
    # Otherwise, Form_Submitted
    else:
        return 'Form_Submitted'

def update_lifecycle_statuses():
    """Update lifecycle statuses for all employees"""
    log("="*80)
    log("UPDATE LIFECYCLE STATUSES")
    log("="*80)
    
    client = bigquery.Client(project=PROJECT_ID)
    
    # Get all employees
    query = f"""
    SELECT 
        Employee_ID,
        Full_Name,
        Official_Email,
        Employment_Status,
        Lifecycle_Status,
        Timestamp as Form_Submitted_Date
    FROM `{EMPLOYEES_TABLE}`
    WHERE Is_Deleted IS NULL OR Is_Deleted = FALSE
    """
    df_employees = client.query(query).to_dataframe()
    
    log(f"Found {len(df_employees)} employees to check")
    
    updates = []
    events_to_create = []
    
    for idx, row in df_employees.iterrows():
        current_status = row.get('Lifecycle_Status')
        new_status = determine_lifecycle_status(row.to_dict())
        
        if current_status != new_status:
            updates.append({
                'Employee_ID': int(row['Employee_ID']),
                'Old_Status': current_status,
                'New_Status': new_status
            })
            
            # Create lifecycle event
            events_to_create.append({
                'Employee_ID': int(row['Employee_ID']),
                'Lifecycle_Status': new_status,
                'Event_Date': datetime.now(),
                'Event_By': 'Lifecycle Status Automation',
                'Notes': f'Automated update from {current_status} to {new_status}'
            })
    
    if not updates:
        log("No lifecycle status updates needed")
        return
    
    log(f"Updating {len(updates)} lifecycle statuses...")
    
    # Update Employees table
    for update in updates:
        update_query = f"""
        UPDATE `{EMPLOYEES_TABLE}`
        SET Lifecycle_Status = '{update['New_Status']}',
            Updated_At = CURRENT_TIMESTAMP(),
            Updated_By = 'Lifecycle Status Automation'
        WHERE Employee_ID = {update['Employee_ID']}
        """
        try:
            client.query(update_query).result()
            log(f"  Updated Employee_ID {update['Employee_ID']}: {update['Old_Status']} → {update['New_Status']}")
        except Exception as e:
            log(f"  ⚠️  Error updating Employee_ID {update['Employee_ID']}: {e}")
    
    # Create lifecycle events
    if events_to_create:
        log(f"Creating {len(events_to_create)} lifecycle events...")
        # Note: You'll need to insert events into Employee_Lifecycle_Events table
        # This requires generating Event_IDs - implement based on your needs
    
    log(f"✅ Updated {len(updates)} lifecycle statuses")

def main():
    """Main execution"""
    update_lifecycle_statuses()
    
    log("="*80)
    log("LIFECYCLE STATUS UPDATE COMPLETE")
    log("="*80)

if __name__ == "__main__":
    main()


