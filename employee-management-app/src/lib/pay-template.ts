import "server-only";
import { getBigQueryClient } from "@/lib/bigquery";
import type { PayTemplateNewHire, PayTemplateLeaver, PayTemplateIncrement, PayTemplateConfirmation } from "@/types/payroll";

const projectId = process.env.GCP_PROJECT_ID;
const dataset = process.env.BQ_DATASET;

if (!projectId || !dataset) {
  throw new Error("Missing BigQuery configuration for pay template");
}

const employeesTableRef = `\`${projectId}.${dataset}.${process.env.BQ_TABLE ?? "Employees"}\``;
const salariesTableRef = `\`${projectId}.${dataset}.Salaries\``;

// Lookup Employee ID by name or email
export async function lookupEmployeeId(name: string, email?: string): Promise<string | null> {
  try {
    const bigquery = getBigQueryClient();
    const query = `
      SELECT Employee_ID
      FROM ${employeesTableRef}
      WHERE Full_Name = @name
         OR Official_Email = @email
      LIMIT 1
    `;
    
    const [rows] = await bigquery.query({
      query,
      params: {
        name,
        email: email || "",
      },
    });
    
    if (rows.length > 0) {
      return String((rows[0] as { Employee_ID: string | number }).Employee_ID);
    }
    return null;
  } catch (error) {
    console.error('[PAY_TEMPLATE] Error looking up Employee ID:', error);
    return null;
  }
}

// Lookup Previous Salary from Salaries table or Employees table
export async function lookupPreviousSalary(employeeId: string, currency: string): Promise<number | null> {
  try {
    const bigquery = getBigQueryClient();
    
    // First try: Get latest Gross_Income from Salaries table
    const salariesQuery = `
      SELECT Gross_Income
      FROM ${salariesTableRef}
      WHERE Employee_ID = @employeeId
        AND Currency = @currency
      ORDER BY Payroll_Month DESC
      LIMIT 1
    `;
    
    const [salaryRows] = await bigquery.query({
      query: salariesQuery,
      params: {
        employeeId: Number(employeeId),
        currency,
      },
    });
    
    if (salaryRows.length > 0) {
      const grossIncome = (salaryRows[0] as { Gross_Income: number }).Gross_Income;
      if (grossIncome != null) {
        return Number(grossIncome);
      }
    }
    
    // Second try: Get Gross_Salary from Employees table
    const employeesQuery = `
      SELECT Gross_Salary
      FROM ${employeesTableRef}
      WHERE Employee_ID = @employeeId
    `;
    
    const [employeeRows] = await bigquery.query({
      query: employeesQuery,
      params: {
        employeeId: Number(employeeId),
      },
    });
    
    if (employeeRows.length > 0) {
      const grossSalary = (employeeRows[0] as { Gross_Salary: number }).Gross_Salary;
      if (grossSalary != null) {
        return Number(grossSalary);
      }
    }
    
    return null;
  } catch (error) {
    console.error('[PAY_TEMPLATE] Error looking up Previous Salary:', error);
    return null;
  }
}

// Fetch New Hires for a given month
export async function fetchNewHires(month: string): Promise<PayTemplateNewHire[]> {
  try {
    const bigquery = getBigQueryClient();
    const tableRef = `\`${projectId}.${dataset}.Pay_Template_New_Hires\``;
    
    const query = `
      SELECT *
      FROM ${tableRef}
      WHERE Month = @month
      ORDER BY Date_of_Joining ASC
    `;
    
    const [rows] = await bigquery.query({
      query,
      params: { month },
    });
    
    return (rows as any[]).map((row) => ({
      Type: String(row.Type ?? 'New Hire'),
      Month: String(row.Month ?? month),
      Employee_ID: row.Employee_ID ? String(row.Employee_ID) : null,
      Employee_Name: String(row.Employee_Name ?? ''),
      Designation: row.Designation ? String(row.Designation) : null,
      Official_Email: row.Official_Email ? String(row.Official_Email) : null,
      Date_of_Joining: row.Date_of_Joining ? String(row.Date_of_Joining).split('T')[0] : '',
      Currency: String(row.Currency ?? 'PKR'),
      Salary: Number(row.Salary ?? 0),
      Employment_Location: row.Employment_Location ? String(row.Employment_Location) : null,
      Bank_Name: row.Bank_Name ? String(row.Bank_Name) : null,
      Bank_Account_Title: row.Bank_Account_Title ? String(row.Bank_Account_Title) : null,
      Bank_Account_Number_IBAN: row.Bank_Account_Number_IBAN ? String(row.Bank_Account_Number_IBAN) : null,
      Swift_Code_BIC: row.Swift_Code_BIC ? String(row.Swift_Code_BIC) : null,
      Comments_by_Aun: row.Comments_by_Aun ? String(row.Comments_by_Aun) : null,
      Created_At: row.Created_At ? String(row.Created_At) : null,
      Updated_At: row.Updated_At ? String(row.Updated_At) : null,
    }));
  } catch (error) {
    console.error('[PAY_TEMPLATE] Error fetching new hires:', error);
    // If table doesn't exist, return empty array
    if ((error as any)?.code === 404) {
      return [];
    }
    throw error;
  }
}

// Fetch Leavers for a given month
export async function fetchLeavers(month: string): Promise<PayTemplateLeaver[]> {
  try {
    const bigquery = getBigQueryClient();
    const tableRef = `\`${projectId}.${dataset}.Pay_Template_Leavers\``;
    
    const query = `
      SELECT *
      FROM ${tableRef}
      WHERE Month = @month
      ORDER BY Employment_End_Date ASC
    `;
    
    const [rows] = await bigquery.query({
      query,
      params: { month },
    });
    
    return (rows as any[]).map((row) => ({
      Type: String(row.Type ?? 'Leaver'),
      Month: String(row.Month ?? month),
      Employee_ID: row.Employee_ID ? String(row.Employee_ID) : null,
      Employee_Name: String(row.Employee_Name ?? ''),
      Employment_End_Date: row.Employment_End_Date ? String(row.Employment_End_Date).split('T')[0] : '',
      Payroll_Type: String(row.Payroll_Type ?? 'PKR'),
      Comments: row.Comments ? String(row.Comments) : null,
      Devices_Returned: row.Devices_Returned ? String(row.Devices_Returned) : null,
      Comments_by_Aun: row.Comments_by_Aun ? String(row.Comments_by_Aun) : null,
      Created_At: row.Created_At ? String(row.Created_At) : null,
      Updated_At: row.Updated_At ? String(row.Updated_At) : null,
    }));
  } catch (error) {
    console.error('[PAY_TEMPLATE] Error fetching leavers:', error);
    // If table doesn't exist, return empty array
    if ((error as any)?.code === 404) {
      return [];
    }
    throw error;
  }
}

// Fetch Increments for a given month
export async function fetchIncrements(month: string): Promise<PayTemplateIncrement[]> {
  try {
    const bigquery = getBigQueryClient();
    const tableRef = `\`${projectId}.${dataset}.Pay_Template_Increments\``;
    
    const query = `
      SELECT *
      FROM ${tableRef}
      WHERE Month = @month
      ORDER BY Effective_Date ASC
    `;
    
    const [rows] = await bigquery.query({
      query,
      params: { month },
    });
    
    return (rows as any[]).map((row) => ({
      Type: String(row.Type ?? 'Increment'),
      Month: String(row.Month ?? month),
      Employee_ID: row.Employee_ID ? String(row.Employee_ID) : null,
      Employee_Name: String(row.Employee_Name ?? ''),
      Currency: String(row.Currency ?? 'PKR'),
      Previous_Salary: row.Previous_Salary != null ? Number(row.Previous_Salary) : null,
      Updated_Salary: Number(row.Updated_Salary ?? 0),
      Effective_Date: row.Effective_Date ? String(row.Effective_Date).split('T')[0] : '',
      Comments: row.Comments ? String(row.Comments) : null,
      Remarks: row.Remarks ? String(row.Remarks) : null,
      Created_At: row.Created_At ? String(row.Created_At) : null,
      Updated_At: row.Updated_At ? String(row.Updated_At) : null,
    }));
  } catch (error) {
    console.error('[PAY_TEMPLATE] Error fetching increments:', error);
    // If table doesn't exist, return empty array
    if ((error as any)?.code === 404) {
      return [];
    }
    throw error;
  }
}

// Fetch Confirmations for a given month
export async function fetchConfirmations(month: string): Promise<PayTemplateConfirmation[]> {
  try {
    const bigquery = getBigQueryClient();
    const tableRef = `\`${projectId}.${dataset}.Pay_Template_Confirmations\``;
    
    const query = `
      SELECT *
      FROM ${tableRef}
      WHERE Month = @month
      ORDER BY Confirmation_Date ASC
    `;
    
    const [rows] = await bigquery.query({
      query,
      params: { month },
    });
    
    return (rows as any[]).map((row) => ({
      Employee_ID: row.Employee_ID ? String(row.Employee_ID) : null,
      Employee_Name: String(row.Employee_Name ?? ''),
      Probation_End_Date: row.Probation_End_Date ? String(row.Probation_End_Date).split('T')[0] : '',
      Confirmation_Date: row.Confirmation_Date ? String(row.Confirmation_Date).split('T')[0] : '',
      Currency: row.Currency ? String(row.Currency) : null,
      Updated_Salary: row.Updated_Salary != null ? Number(row.Updated_Salary) : null,
      Month: String(row.Month ?? month),
      Created_At: row.Created_At ? String(row.Created_At) : null,
      Updated_At: row.Updated_At ? String(row.Updated_At) : null,
    }));
  } catch (error) {
    console.error('[PAY_TEMPLATE] Error fetching confirmations:', error);
    // If table doesn't exist, return empty array
    if ((error as any)?.code === 404) {
      return [];
    }
    throw error;
  }
}
