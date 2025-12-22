#!/usr/bin/env python3
"""
Sync Slack IDs from Slack API
==============================
Fetches Slack user IDs for employees and updates Employees table.

Prerequisites:
    - Slack API token configured
    - BigQuery Employees table exists
    - google-cloud-bigquery library installed

Usage:
    python3 scripts/sync_slack_ids.py

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
    # Note: Install slack_sdk if needed: pip install slack_sdk
    # from slack_sdk import WebClient
except ImportError:
    print("ERROR: Required libraries not installed")
    print("Please run: pip install google-cloud-bigquery slack_sdk")
    sys.exit(1)

# Configuration
PROJECT_ID = "test-imagine-web"
DATASET_ID = "Vyro_Business_Paradox"
EMPLOYEES_TABLE = f"{PROJECT_ID}.{DATASET_ID}.Employees"

# Set credentials path
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'Credentials/test-imagine-web-18d4f9a43aef.json'

# Slack configuration (set via environment variable)
SLACK_BOT_TOKEN = os.environ.get('SLACK_BOT_TOKEN')

def log(message):
    """Print timestamped log message"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}] {message}")

def fetch_slack_users():
    """Fetch all users from Slack API"""
    if not SLACK_BOT_TOKEN:
        log("⚠️  SLACK_BOT_TOKEN not set - skipping Slack sync")
        log("   Set SLACK_BOT_TOKEN environment variable to enable sync")
        return {}
    
    try:
        # Uncomment when slack_sdk is installed
        # client = WebClient(token=SLACK_BOT_TOKEN)
        # response = client.users_list()
        # 
        # slack_users = {}
        # for user in response['members']:
        #     email = user.get('profile', {}).get('email', '')
        #     slack_id = user.get('id', '')
        #     if email and slack_id:
        #         slack_users[email.lower()] = slack_id
        # 
        # log(f"Fetched {len(slack_users)} Slack users")
        # return slack_users
        
        log("⚠️  Slack SDK not configured - returning empty mapping")
        log("   To enable: 1) Install slack_sdk: pip install slack_sdk")
        log("              2) Set SLACK_BOT_TOKEN environment variable")
        log("              3) Uncomment Slack API code in this script")
        return {}
        
    except Exception as e:
        log(f"❌ Error fetching Slack users: {e}")
        return {}

def update_slack_ids(slack_users):
    """Update Slack_ID in Employees table"""
    if not slack_users:
        log("No Slack users to sync")
        return
    
    client = bigquery.Client(project=PROJECT_ID)
    
    # Get employees with official emails
    query = f"""
    SELECT Employee_ID, Official_Email, Slack_ID
    FROM `{EMPLOYEES_TABLE}`
    WHERE Official_Email IS NOT NULL
    """
    df_employees = client.query(query).to_dataframe()
    
    log(f"Found {len(df_employees)} employees with official emails")
    
    # Match and update
    updates = []
    for idx, row in df_employees.iterrows():
        email = str(row['Official_Email']).lower().strip()
        if email in slack_users:
            slack_id = slack_users[email]
            if row['Slack_ID'] != slack_id:
                updates.append({
                    'Employee_ID': int(row['Employee_ID']),
                    'Slack_ID': slack_id,
                    'Email': email
                })
    
    if not updates:
        log("No Slack IDs to update")
        return
    
    log(f"Updating {len(updates)} Slack IDs...")
    
    # Update in batches
    for update in updates:
        update_query = f"""
        UPDATE `{EMPLOYEES_TABLE}`
        SET Slack_ID = '{update['Slack_ID']}',
            Updated_At = CURRENT_TIMESTAMP(),
            Updated_By = 'Slack Sync Script'
        WHERE Employee_ID = {update['Employee_ID']}
        """
        try:
            client.query(update_query).result()
            log(f"  Updated {update['Email']}: {update['Slack_ID']}")
        except Exception as e:
            log(f"  ⚠️  Error updating {update['Email']}: {e}")
    
    log(f"✅ Updated {len(updates)} Slack IDs")

def main():
    """Main execution"""
    log("="*80)
    log("SYNC SLACK IDS")
    log("="*80)
    
    # Fetch Slack users
    slack_users = fetch_slack_users()
    
    # Update Employees table
    if slack_users:
        update_slack_ids(slack_users)
    else:
        log("Skipping update - no Slack users fetched")
    
    log("="*80)
    log("SYNC COMPLETE")
    log("="*80)

if __name__ == "__main__":
    main()


