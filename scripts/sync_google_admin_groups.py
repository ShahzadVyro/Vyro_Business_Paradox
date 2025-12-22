#!/usr/bin/env python3
"""
Sync Google Admin Groups
========================
Fetches Group_Name and Group_Email from Google Admin API and updates Employees table.

Prerequisites:
    - Google Admin SDK credentials configured
    - BigQuery Employees table exists
    - google-cloud-bigquery and google-api-python-client libraries installed

Usage:
    python3 scripts/sync_google_admin_groups.py

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
    # Note: Install google-api-python-client if needed: pip install google-api-python-client
    # from google.oauth2 import service_account
    # from googleapiclient.discovery import build
except ImportError:
    print("ERROR: Required libraries not installed")
    print("Please run: pip install google-cloud-bigquery google-api-python-client")
    sys.exit(1)

# Configuration
PROJECT_ID = "test-imagine-web"
DATASET_ID = "Vyro_Business_Paradox"
EMPLOYEES_TABLE = f"{PROJECT_ID}.{DATASET_ID}.Employees"

# Set credentials path
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'Credentials/test-imagine-web-18d4f9a43aef.json'

# Google Admin configuration
GOOGLE_ADMIN_CREDENTIALS = os.environ.get('GOOGLE_ADMIN_CREDENTIALS', 'Credentials/test-imagine-web-18d4f9a43aef.json')

def log(message):
    """Print timestamped log message"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def fetch_google_groups():
    """Fetch groups from Google Admin API"""
    try:
        # Uncomment when google-api-python-client is installed and configured
        # credentials = service_account.Credentials.from_service_account_file(
        #     GOOGLE_ADMIN_CREDENTIALS,
        #     scopes=['https://www.googleapis.com/auth/admin.directory.group.readonly']
        # )
        # 
        # service = build('admin', 'directory_v1', credentials=credentials)
        # 
        # groups = {}
        # page_token = None
        # 
        # while True:
        #     results = service.groups().list(
        #         domain='vyro.ai',
        #         pageToken=page_token,
        #         maxResults=500
        #     ).execute()
        # 
        #     for group in results.get('groups', []):
        #         email = group.get('email', '').lower()
        #         name = group.get('name', '')
        #         if email:
        #             groups[email] = {
        #                 'name': name,
        #                 'email': email
        #             }
        # 
        #     page_token = results.get('nextPageToken')
        #     if not page_token:
        #         break
        # 
        # log(f"Fetched {len(groups)} Google groups")
        # return groups
        
        log("⚠️  Google Admin API not configured - returning empty mapping")
        log("   To enable: 1) Install google-api-python-client: pip install google-api-python-client")
        log("              2) Configure Google Admin API credentials")
        log("              3) Uncomment Google Admin API code in this script")
        return {}
        
    except Exception as e:
        log(f"❌ Error fetching Google groups: {e}")
        return {}

def get_employee_groups(employee_email):
    """Get groups for a specific employee email"""
    # This would query Google Admin API to find which groups the employee belongs to
    # For now, return empty - implement based on your Google Admin setup
    return []

def update_group_info():
    """Update Group_Name and Group_Email in Employees table"""
    client = bigquery.Client(project=PROJECT_ID)
    
    # Get employees with official emails
    query = f"""
    SELECT Employee_ID, Official_Email, Group_Name, Group_Email
    FROM `{EMPLOYEES_TABLE}`
    WHERE Official_Email IS NOT NULL
    """
    df_employees = client.query(query).to_dataframe()
    
    log(f"Found {len(df_employees)} employees with official emails")
    
    # Fetch Google groups
    groups = fetch_google_groups()
    
    if not groups:
        log("No Google groups to sync")
        return
    
    # For each employee, find their groups and update
    # This is a simplified version - you may need to query group membership differently
    updates = []
    for idx, row in df_employees.iterrows():
        email = str(row['Official_Email']).lower().strip()
        employee_groups = get_employee_groups(email)
        
        if employee_groups:
            # Use primary group or first group
            primary_group = employee_groups[0] if employee_groups else None
            if primary_group and primary_group in groups:
                group_info = groups[primary_group]
                updates.append({
                    'Employee_ID': int(row['Employee_ID']),
                    'Group_Name': group_info['name'],
                    'Group_Email': group_info['email']
                })
    
    if not updates:
        log("No group information to update")
        return
    
    log(f"Updating {len(updates)} group assignments...")
    
    # Update in batches
    for update in updates:
        update_query = f"""
        UPDATE `{EMPLOYEES_TABLE}`
        SET Group_Name = '{update['Group_Name']}',
            Group_Email = '{update['Group_Email']}',
            Updated_At = CURRENT_TIMESTAMP(),
            Updated_By = 'Google Admin Sync Script'
        WHERE Employee_ID = {update['Employee_ID']}
        """
        try:
            client.query(update_query).result()
            log(f"  Updated Employee_ID {update['Employee_ID']}: {update['Group_Name']}")
        except Exception as e:
            log(f"  ⚠️  Error updating Employee_ID {update['Employee_ID']}: {e}")
    
    log(f"✅ Updated {len(updates)} group assignments")

def main():
    """Main execution"""
    log("="*80)
    log("SYNC GOOGLE ADMIN GROUPS")
    log("="*80)
    
    update_group_info()
    
    log("="*80)
    log("SYNC COMPLETE")
    log("="*80)

if __name__ == "__main__":
    main()


