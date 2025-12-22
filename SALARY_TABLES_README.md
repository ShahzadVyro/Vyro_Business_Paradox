# Salary Tables Setup Guide

This guide explains how to create and load salary data into BigQuery tables.

## Overview

Two BigQuery tables are created for salary data:
1. **Combined-USD_2025** - USD salary data from `Salaries USD __ Master Tracker Paradox - Combined-USD 2025.csv`
2. **Combined-PKR_2025** - PKR salary data from `Salaries PKR __ Master Tracker Paradox - Combined-PKR 2025.csv`

## Prerequisites

1. **Google Cloud Project**: `test-imagine-web`
2. **BigQuery Dataset**: `Vyro_Business_Paradox`
3. **Credentials**: Service account JSON file at `Credentials/test-imagine-web-18d4f9a43aef.json`
4. **Python Libraries**:
   ```bash
   pip install google-cloud-bigquery pandas-gbq pyarrow pandas
   ```

## Quick Start

### Option 1: Automatic (Recommended)

Run the Python script which will create tables and load data automatically:

```bash
python3 load_salaries_to_bigquery.py
```

The script will:
- Check if tables exist (create if needed)
- Load USD salaries CSV
- Load PKR salaries CSV
- Verify the data load

### Option 2: Manual Table Creation

If you prefer to create tables manually first:

```bash
# Create tables using SQL schema
bq query --use_legacy_sql=false < create_salary_tables.sql

# Then load data
python3 load_salaries_to_bigquery.py
```

## Table Schemas

### Combined-USD_2025

Contains USD salary data with the following key fields:
- Employee identification (ID, Name, Email, Designation)
- Dates (Joining, Leaving, Increment dates)
- Pay components (Regular Pay, Prorated Pay, Performance Bonus, Overtime, Reimbursements)
- Income calculations (Gross Income, Deductions, Net Income)
- Month and currency information

### Combined-PKR_2025

Contains PKR salary data with additional fields:
- All fields from USD table, plus:
- Prorated allowances (Base Pay, Medical, Transport, Inflation)
- Tax information (Taxable Income, Tax Deduction)
- EOBI contributions
- Loan deductions and recoveries

## Data Sources

- **USD CSV**: `/Users/shahzadvyro/Desktop/Vyro_Business_Paradox/Salaries USD __ Master Tracker Paradox - Combined-USD 2025.csv`
- **PKR CSV**: `/Users/shahzadvyro/Desktop/Vyro_Business_Paradox/Salaries PKR __ Master Tracker Paradox - Combined-PKR 2025.csv`

## Querying the Data

### View Combined Salaries

A view `Salaries_Combined_2025` is available that combines both USD and PKR data:

```sql
SELECT * FROM `test-imagine-web.Vyro_Business_Paradox.Salaries_Combined_2025`
WHERE Month = 'Jan'
ORDER BY Currency_Type, Employee_Name;
```

### Get USD Salaries for a Month

```sql
SELECT 
    Employee_ID,
    Employee_Name,
    Designation,
    Gross_Income,
    Net_Income,
    Month
FROM `test-imagine-web.Vyro_Business_Paradox.Combined-USD_2025`
WHERE Month = 'Jan'
ORDER BY Employee_Name;
```

### Get PKR Salaries for an Employee

```sql
SELECT 
    Month,
    Regular_Pay,
    Performance_Bonus,
    Tax_Deduction,
    EOBI,
    Gross_Income,
    Net_Income
FROM `test-imagine-web.Vyro_Business_Paradox.Combined-PKR_2025`
WHERE Employee_ID = '5184'
ORDER BY Month;
```

### Monthly Summary

```sql
SELECT 
    Month,
    Currency_Type,
    COUNT(DISTINCT Employee_ID) as Employee_Count,
    SUM(Gross_Income) as Total_Gross_Income,
    SUM(Net_Income) as Total_Net_Income,
    AVG(Net_Income) as Avg_Net_Income
FROM `test-imagine-web.Vyro_Business_Paradox.Salaries_Combined_2025`
GROUP BY Month, Currency_Type
ORDER BY Month, Currency_Type;
```

## Data Cleaning

The script automatically:
- Removes total/summary rows
- Cleans numeric values (removes commas, handles empty values)
- Parses dates in various formats
- Handles missing/null values
- Converts string numbers to proper numeric types

## Troubleshooting

### Error: "Dataset not found"
- Ensure the dataset `Vyro_Business_Paradox` exists in BigQuery
- Check project ID is correct: `test-imagine-web`

### Error: "Credentials not found"
- Verify the credentials file exists at: `Credentials/test-imagine-web-18d4f9a43aef.json`
- Check file permissions

### Error: "Table already exists"
- The script uses `if_exists='replace'` which will overwrite existing data
- To append instead, modify the script to use `if_exists='append'`

### Data Type Errors
- Check CSV files for unexpected formats
- Verify date formats are consistent
- Ensure numeric fields don't contain text

## Files

- `load_salaries_to_bigquery.py` - Main script to load data
- `create_salary_tables.sql` - SQL schema for creating tables
- `SALARY_TABLES_README.md` - This file

## Next Steps

1. Verify data in BigQuery console
2. Create additional views or queries as needed
3. Set up appropriate access controls
4. Schedule regular data loads if needed
5. Integrate with your applications







