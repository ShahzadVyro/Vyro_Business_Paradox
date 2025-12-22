# Database Architecture Documentation

## Overview

This directory contains the complete database architecture for the unified employee management system. The architecture follows a **star schema (dimensional model)** design optimized for dashboard queries and reporting.

## Directory Structure

```
database/
├── dimensions/          # Dimension tables (master data)
├── facts/               # Fact tables (transactional/time-series data)
├── views/               # Dashboard views and queries
├── functions/           # Calculated fields and functions
├── migrations/          # Data migration scripts
└── README.md           # This file
```

## Architecture Overview

### Dimension Tables (Master Data)

1. **Employees** - Single source of truth for all employee master data
2. **Devices** - Device catalog for asset tracking
3. **Access_Platforms** - Platform catalog for access management
4. **Employee_Lifecycle_Events** - Tracks onboarding journey
5. **Employee_Status_History** - Historical employment status changes
6. **Employee_Field_Updates** - Audit trail for field changes

### Fact Tables (Transactional Data)

1. **Employee_Salaries** - Monthly salary transactions
2. **Employee_EOBI** - Monthly EOBI contributions
3. **Employee_Device_Assignments** - Device assignment history
4. **Employee_Access_Grants** - Access permission history

### Views

1. **Employee_Profile_View** - Complete employee profile with devices and access
2. **Onboarding_Dashboard_View** - Onboarding progress tracking
3. **Payroll_Summary_Monthly** - Monthly payroll summaries
4. **Payroll_Summary_YTD** - Year-to-date payroll totals
5. **Payroll_Trends** - Salary trends over time
6. **Device_Inventory_View** - Current device assignments
7. **Available_Devices_View** - Available devices for assignment
8. **Device_Utilization_Metrics** - Device utilization statistics
9. **Access_Audit_View** - Access permissions audit
10. **Access_By_Platform_Summary** - Access summary by platform
11. **Access_Compliance_Issues** - Compliance issues and risks

## Key Design Principles

### 1. Employee ID Preservation

- **CRITICAL**: All existing Employee_IDs are preserved exactly as they are
- Only new numeric IDs are assigned to records missing Employee_ID
- No conversion or changes to existing IDs

### 2. Normalization

- Employee master data in one dimension table
- Time-series data (salaries, EOBI) in separate fact tables
- Many-to-many relationships (devices, access) in bridge tables

### 3. Lifecycle Tracking

- Tracks employee journey from form submission to onboarding
- Lifecycle_Status: Form_Submitted → Data_Added → Email_Created → Employee_ID_Assigned → Onboarded → Active

### 4. Audit Trail

- All field changes logged in Employee_Field_Updates table
- Historical status changes in Employee_Status_History
- Lifecycle events tracked in Employee_Lifecycle_Events

## Setup Instructions

### Step 1: Create Dimension Tables

```bash
# Create Employees table
bq query --use_legacy_sql=false < database/dimensions/create_employees_dimension.sql

# Create supporting dimension tables
bq query --use_legacy_sql=false < database/dimensions/create_employee_lifecycle_events.sql
bq query --use_legacy_sql=false < database/dimensions/create_employee_status_history.sql
bq query --use_legacy_sql=false < database/dimensions/create_employee_field_updates.sql
bq query --use_legacy_sql=false < database/dimensions/create_devices_dimension.sql
bq query --use_legacy_sql=false < database/dimensions/create_access_platforms_dimension.sql
```

### Step 2: Create Fact Tables

```bash
# Create salary fact table
bq query --use_legacy_sql=false < database/facts/create_salary_fact_table.sql

# Create EOBI fact table
bq query --use_legacy_sql=false < database/facts/create_eobi_fact_table.sql

# Create device assignments table
bq query --use_legacy_sql=false < database/facts/create_employee_device_assignments.sql

# Create access grants table
bq query --use_legacy_sql=false < database/facts/create_employee_access_grants.sql
```

### Step 3: Create Views

```bash
# Create all views
bq query --use_legacy_sql=false < database/views/create_employee_profile_view.sql
bq query --use_legacy_sql=false < database/views/create_onboarding_dashboard_view.sql
bq query --use_legacy_sql=false < database/views/create_payroll_summary_views.sql
bq query --use_legacy_sql=false < database/views/create_device_inventory_view.sql
bq query --use_legacy_sql=false < database/views/create_access_audit_view.sql
```

### Step 4: Create Calculated Fields View

```bash
bq query --use_legacy_sql=false < database/functions/calculate_employee_fields.sql
```

### Step 5: Migrate Existing Data

```bash
# Migrate employee data (preserves existing IDs)
python3 database/migrations/migrate_employee_data.py

# Migrate salary data
python3 database/migrations/migrate_salary_data.py
```

### Step 6: Validate Data

```bash
# Run validation queries
bq query --use_legacy_sql=false < database/migrations/data_validation_queries.sql
```

## Usage Examples

### Query Employee Profile

```sql
SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.Employee_Profile_View`
WHERE Employee_ID = 5395;
```

### Track Onboarding Progress

```sql
SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.Onboarding_Dashboard_View`
WHERE Days_Since_Last_Event > 7
ORDER BY Days_Since_Last_Event DESC;
```

### Monthly Payroll Summary

```sql
SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.Payroll_Summary_Monthly`
WHERE Payroll_Month = DATE_TRUNC(CURRENT_DATE(), MONTH)
ORDER BY Total_Net_Income DESC;
```

### Device Inventory

```sql
SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.Device_Inventory_View`
WHERE Assignment_Status = 'Active'
ORDER BY Device_Type, Assigned_To;
```

### Access Audit

```sql
SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.Access_Audit_View`
WHERE Risk_Level = 'HIGH'
ORDER BY Full_Name;
```

## Maintenance

### Sync External Systems

```bash
# Sync Slack IDs (requires SLACK_BOT_TOKEN env var)
python3 scripts/sync_slack_ids.py

# Sync Google Admin groups (requires Google Admin API setup)
python3 scripts/sync_google_admin_groups.py

# Update lifecycle statuses
python3 scripts/update_lifecycle_status.py
```

### Data Validation

Run validation queries regularly to ensure data integrity:

```bash
bq query --use_legacy_sql=false < database/migrations/data_validation_queries.sql
```

## Important Notes

1. **Employee IDs**: Never change existing Employee_IDs - they are used across multiple systems
2. **Calculated Fields**: Use the `Employees_With_Calculated_Fields` view for computed values
3. **Lifecycle Status**: Automatically updated based on employee data and events
4. **Audit Trail**: All field updates are logged for compliance
5. **Partitioning**: Fact tables are partitioned by date for performance
6. **Clustering**: Tables are clustered for efficient queries

## Support

For questions or issues, refer to the main plan document:
`/Users/shahzadvyro/.cursor/plans/production-ready_database_architecture_for_unified_employee_dashboard_e750e81c.plan.md`
