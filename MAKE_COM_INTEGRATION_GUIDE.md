# Make.com (Integromat) + BigQuery Integration Guide

**Last Updated:** October 30, 2025  
**Status:** Production Ready

---

## 🎯 Overview

Use Make.com to query BigQuery and create automated workflows **WITHOUT CODE**.

### What You Can Do:

- ✅ Get employee list from BigQuery
- ✅ Search employees by name/department/status
- ✅ Add new employees to BigQuery
- ✅ Update employee information
- ✅ Send Slack notifications on changes
- ✅ Sync with Google Sheets (if needed)
- ✅ Create automated reports

---

## 📋 Prerequisites

1. **Make.com Account** (free tier available)
   - Sign up: https://www.make.com
2. **Google Cloud Service Account** (you already have this!)
   - File: `Credentials/test-imagine-web-18d4f9a43aef.json`
3. **BigQuery Table** ✅ (already created!)
   - `test-imagine-web.Vyro_Business_Paradox.EmployeeData_v2`

---

## 🚀 Quick Start (15 minutes)

### Step 1: Create Make.com Account

1. Go to https://www.make.com/en/register
2. Sign up (free tier: 1,000 operations/month)
3. Verify email

### Step 2: Connect Google BigQuery

1. In Make.com, click **"Create a new scenario"**
2. Search for **"Google BigQuery"** module
3. Click **"Add"**
4. Click **"Create a connection"**
5. Choose **"Service Account"** authentication
6. Upload your service account JSON:
   - File: `/Users/shahzadvyro/Desktop/Vyro_Business_Paradox/Credentials/test-imagine-web-18d4f9a43aef.json`
7. Click **"Save"**

✅ You're now connected to BigQuery!

---

## 📚 Common Scenarios

### Scenario 1: Get List of Active Employees

**Use Case:** Retrieve all active employees

**Steps:**

1. Add module: **Google BigQuery > Run a Query**
2. Enter SQL:

```sql
SELECT
    Employee_ID,
    Full_Name,
    Official_Email,
    Department,
    Designation,
    Employment_Status,
    Joining_Date
FROM
    `test-imagine-web.Vyro_Business_Paradox.EmployeeData_v2`
WHERE
    Employment_Status = 'Active'
ORDER BY
    Full_Name
```

3. Run the scenario
4. See results!

### Scenario 2: Search Employee by Name

**Use Case:** Find employee by name (from webhook/form)

**Steps:**

1. Add trigger: **Webhooks > Custom webhook**
2. Add module: **Google BigQuery > Run a Query**
3. Enter SQL:

```sql
SELECT
    *
FROM
    `test-imagine-web.Vyro_Business_Paradox.EmployeeData_v2`
WHERE
    LOWER(Full_Name) LIKE LOWER(CONCAT('%', @searchName, '%'))
    OR Employee_ID = @searchId
```

4. Map parameters:
   - `searchName`: from webhook data
   - `searchId`: from webhook data
5. Add response module to return results

### Scenario 3: Get Employee by ID

**SQL Query:**

```sql
SELECT
    Employee_ID,
    Full_Name,
    Official_Email,
    Personal_Email,
    Department,
    Designation,
    Reporting_Manager,
    Employment_Status,
    Joining_Date,
    Contact_Number,
    Slack_ID
FROM
    `test-imagine-web.Vyro_Business_Paradox.EmployeeData_v2`
WHERE
    Employee_ID = @empId
```

### Scenario 4: Get Employees by Department

**SQL Query:**

```sql
SELECT
    Employee_ID,
    Full_Name,
    Official_Email,
    Designation,
    Joining_Date
FROM
    `test-imagine-web.Vyro_Business_Paradox.EmployeeData_v2`
WHERE
    Department = @department
    AND Employment_Status = 'Active'
ORDER BY
    Full_Name
```

### Scenario 5: Add New Employee

**Steps:**

1. Trigger: **Webhooks > Custom webhook** (receives employee data)
2. Module: **Google BigQuery > Insert Rows**
3. Configure:
   - Project: `test-imagine-web`
   - Dataset: `Vyro_Business_Paradox`
   - Table: `EmployeeData_v2`
   - Map fields from webhook data

**Webhook Payload Example:**

```json
{
  "Employee_ID": "EMP-0463",
  "Full_Name": "Ahmed Khan",
  "Official_Email": "ahmed.khan@vyro.ai",
  "Personal_Email": "ahmed@gmail.com",
  "Department": "Engineering",
  "Designation": "Software Engineer",
  "Employment_Status": "Active",
  "Joining_Date": "2025-11-01",
  "Contact_Number": "03001234567",
  "Created_At": "{{now}}",
  "Updated_At": "{{now}}",
  "Created_By": "HR Portal"
}
```

### Scenario 6: Update Employee Status

**SQL Query:**

```sql
UPDATE
    `test-imagine-web.Vyro_Business_Paradox.EmployeeData_v2`
SET
    Employment_Status = @newStatus,
    Employment_End_Date = @endDate,
    Updated_At = CURRENT_TIMESTAMP()
WHERE
    Employee_ID = @empId
```

### Scenario 7: Send Slack Notification on New Hire

**Flow:**

1. **Schedule** → Run daily at 9 AM Pakistan time
2. **BigQuery** → Get employees who joined in last 24 hours:

```sql
SELECT
    Employee_ID,
    Full_Name,
    Department,
    Designation,
    Official_Email
FROM
    `test-imagine-web.Vyro_Business_Paradox.EmployeeData_v2`
WHERE
    Created_At >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
```

3. **Slack** → Post message to #people-team:

```
🆕 New Employee Alert!
Name: {{Full_Name}}
Department: {{Department}}
Designation: {{Designation}}
Email: {{Official_Email}}
Employee ID: {{Employee_ID}}
```

### Scenario 8: Sync to Google Sheets (Real-time)

**Use Case:** Keep a Google Sheet updated with employee data

**Steps:**

1. **Schedule** → Every 15 minutes
2. **BigQuery** → Get all active employees
3. **Google Sheets** → Clear sheet
4. **Google Sheets** → Add rows with employee data

---

## 🌐 Create HTTP API Endpoints

### Simple Employee API with Make.com

1. Create scenario with **Webhooks > Custom webhook** trigger
2. Get webhook URL (e.g., `https://hook.us1.make.com/xxx`)
3. Add BigQuery query module
4. Add **Webhooks > Webhook response** module
5. Save & activate

**Example Endpoints:**

#### GET Employee by ID

```
GET https://hook.us1.make.com/YOUR_WEBHOOK_ID?employee_id=5090
```

Response:

```json
{
  "Employee_ID": "5090",
  "Full_Name": "John Doe",
  "Department": "Engineering",
  "Employment_Status": "Active"
}
```

#### GET Employees by Department

```
GET https://hook.us1.make.com/YOUR_WEBHOOK_ID?department=Engineering
```

#### POST Add New Employee

```
POST https://hook.us1.make.com/YOUR_WEBHOOK_ID
Content-Type: application/json

{
  "Employee_ID": "EMP-0463",
  "Full_Name": "Ahmed Khan",
  "Department": "Engineering",
  ...
}
```

---

## 📊 Pre-built Scenario Templates

### Template 1: Employee Dashboard Data

**Purpose:** Get summary stats for dashboard

**SQL:**

```sql
SELECT
    COUNT(*) as total_employees,
    COUNTIF(Employment_Status = 'Active') as active_employees,
    COUNTIF(Employment_Status LIKE '%Resigned%' OR Employment_Status LIKE '%Terminated%') as former_employees,
    COUNTIF(Slack_ID IS NOT NULL) as employees_with_slack,
    COUNT(DISTINCT Department) as total_departments
FROM
    `test-imagine-web.Vyro_Business_Paradox.EmployeeData_v2`
```

### Template 2: Department Breakdown

**SQL:**

```sql
SELECT
    Department,
    COUNT(*) as employee_count,
    COUNTIF(Employment_Status = 'Active') as active_count
FROM
    `test-imagine-web.Vyro_Business_Paradox.EmployeeData_v2`
WHERE
    Department IS NOT NULL
GROUP BY
    Department
ORDER BY
    employee_count DESC
```

### Template 3: Recent Joiners (Last 30 Days)

**SQL:**

```sql
SELECT
    Employee_ID,
    Full_Name,
    Department,
    Designation,
    Joining_Date,
    Official_Email
FROM
    `test-imagine-web.Vyro_Business_Paradox.EmployeeData_v2`
WHERE
    Joining_Date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
    AND Employment_Status = 'Active'
ORDER BY
    Joining_Date DESC
```

### Template 4: Employees Without Slack ID

**SQL:**

```sql
SELECT
    Employee_ID,
    Full_Name,
    Official_Email,
    Department
FROM
    `test-imagine-web.Vyro_Business_Paradox.EmployeeData_v2`
WHERE
    Employment_Status = 'Active'
    AND (Slack_ID IS NULL OR Slack_ID = '')
ORDER BY
    Full_Name
```

---

## 🔐 Security Best Practices

1. **Webhook URLs**

   - Keep webhook URLs private
   - Add authentication tokens
   - Validate input data

2. **Rate Limiting**

   - Use Make.com's built-in limits
   - Add error handling

3. **Data Validation**
   - Validate employee IDs format
   - Check required fields
   - Sanitize inputs

---

## 💡 Advanced Use Cases

### Auto-onboarding Workflow

```
Google Form (New Employee)
    ↓
Make.com Webhook
    ↓
1. Generate Employee ID (get max ID + 1)
2. Create official email (firstname.lastname@vyro.ai)
3. Insert into BigQuery
4. Send Slack notification to #people-team
5. Create Google Workspace account (optional)
6. Send welcome email to employee
```

### Monthly Report Automation

```
Schedule (1st of each month, 9 AM PKT)
    ↓
1. Query: New hires last month
2. Query: Resignations last month
3. Query: Department breakdown
4. Generate PDF report
5. Email to management
6. Post summary to Slack
```

### Employee Birthday Reminders

```
Schedule (Daily, 8 AM PKT)
    ↓
1. Query employees with birthday today:
   WHERE EXTRACT(MONTH FROM Date_of_Birth) = EXTRACT(MONTH FROM CURRENT_DATE())
     AND EXTRACT(DAY FROM Date_of_Birth) = EXTRACT(DAY FROM CURRENT_DATE())
2. Post to Slack: "🎂 Birthday today: {{Full_Name}}!"
```

---

## 🐛 Troubleshooting

### Error: "Permission denied"

- Check service account has BigQuery permissions
- Re-upload service account JSON in Make.com

### Error: "Table not found"

- Verify table name: `test-imagine-web.Vyro_Business_Paradox.EmployeeData_v2`
- Check project ID matches

### Error: "Query timeout"

- Add LIMIT to queries
- Optimize with WHERE clauses
- Use clustered columns (Employee_ID, Employment_Status, Department)

### Duplicates in Results

- ✅ FIXED! We deduplicated the data
- Each employee now has exactly 1 row

---

## 📈 Make.com Pricing

- **Free Tier:** 1,000 operations/month
- **Core:** $9/month - 10,000 operations
- **Pro:** $16/month - 10,000 operations + advanced features
- **Teams:** $29/month - 10,000 operations + team features

**Recommendation:** Start with Free tier, upgrade if needed

---

## 🎯 Next Steps

1. **Today:** Create Make.com account and connect BigQuery
2. **This Week:** Build 2-3 basic scenarios (employee list, search)
3. **Next Week:** Add Slack integrations
4. **Month 1:** Build complete auto-onboarding workflow

---

## 📞 Quick Reference

### BigQuery Connection Details

- **Project ID:** `test-imagine-web`
- **Dataset:** `Vyro_Business_Paradox`
- **Table:** `EmployeeData_v2`
- **Service Account:** `Credentials/test-imagine-web-18d4f9a43aef.json`

### Key Fields

- **Employee_ID** - Unique identifier
- **Employment_Status** - Active/Resigned/Terminated
- **Department** - Employee department
- **Slack_ID** - For Slack integration

### Timezone

- **Pakistan:** GMT+5 (Asia/Karachi)
- All timestamps stored in PKT

---

**Ready to build your first Make.com scenario!** 🚀

Start with Scenario 1 (Get Active Employees) and expand from there.

