# Vercel Environment Variables Setup

## Required Environment Variables

Make sure these environment variables are set correctly in your Vercel project:

### Production Environment

```
GCP_PROJECT_ID=test-imagine-web
BQ_DATASET=Vyro_Business_Paradox
BQ_TABLE=Employees
```

### Important Notes

- **`BQ_TABLE` must be set to `Employees`** (the new unified table)
- Do NOT use old table names like:
  - `EmployeeData_v2`
  - `EmployeeDirectoryLatest_v1`
  - `EmployeeDirectory_v1`
  - `EmployeeData`

### How to Update in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Find `BQ_TABLE` and update it to `Employees`
4. If `BQ_TABLE` doesn't exist, add it with value `Employees`
5. Redeploy the application (or wait for automatic redeploy)

### Verification

After updating, check the production logs. You should see:

```
[DASHBOARD] Configuration: {
  projectId: 'test-imagine-web',
  dataset: 'Vyro_Business_Paradox',
  employeeTable: 'Employees',
  ...
}
```

If you see a different `employeeTable` value, the environment variable is not set correctly.

