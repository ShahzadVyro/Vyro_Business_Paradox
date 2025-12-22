export interface SalaryRecord {
  // Core fields
  Salary_ID?: number | null; // Primary key for salary record
  Payroll_Month: string | null; // Can be null from BigQuery
  Currency: string;
  Employee_ID: number | null; // INT64 - standardized numeric ID
  Employee_Name?: string | null; // From Employees join
  
  // Salary Components (new schema)
  Regular_Pay: number | null;
  Prorated_Pay: number | null;
  Prorated_Base_Pay: number | null;
  Prorated_Medical_Allowance: number | null;
  Prorated_Transport_Allowance: number | null;
  Prorated_Inflation_Allowance: number | null;
  Performance_Bonus: number | null;
  Paid_Overtime: number | null;
  Reimbursements: number | null;
  Other: number | null; // Renamed from Other_Adjustments
  
  // Income Calculations
  Taxable_Income: number | null;
  Gross_Income: number | null;
  
  // Deductions
  Unpaid_Leaves: number | null;
  Tax_Deduction: number | null;
  EOBI: number | null;
  Loan_Deduction: number | null;
  Recoveries: number | null;
  Deductions: number | null;
  
  // Final Amount
  Net_Income: number | null;
  
  // Additional Fields
  Worked_Days: number | null;
  Comments: string | null;
  Internal_Comments?: string | null;
  Salary_Status?: string | null;
  PaySlip_Status?: string | null;
  Payable_from_Last_Month?: number | null;
  Date_of_Joining?: string | null;
  Date_of_Leaving?: string | null;
  Date_of_Increment_Decrement?: string | null;
  
  // Employee State at Payroll (new fields)
  Designation_At_Payroll?: string | null;
  Department_At_Payroll?: string | null;
  Bank_Account_At_Payroll?: string | null;
  Bank_Name_At_Payroll?: string | null;
  Salary_Effective_Date?: string | null;
  
  // Legacy fields (for backward compatibility with old schema)
  Personal_Email?: string | null;
  Official_Email?: string | null;
  Joining_Date?: string | null;
  Designation?: string | null;
  Department?: string | null;
  Reporting_Manager?: string | null;
  Job_Type?: string | null;
  Status?: string | null;
  Employment_Status?: string | null;
  Probation_Period?: string | null;
  Probation_End_Date?: string | null;
  Basic_Salary?: number | null;
  Medical?: number | null;
  Gross_Salary?: string | null;
  Contact_Number?: string | null;
  CNIC_ID?: string | null;
  Gender?: string | null;
  Bank_Name?: string | null;
  Bank_Account_Title?: string | null;
  Bank_Account_IBAN?: string | null;
  Swift_Code_BIC?: string | null;
  Routing_Number?: string | null;
  Employment_Location?: string | null;
  Date_of_Birth?: string | null;
  Address?: string | null;
  Nationality?: string | null;
  Marital_Status?: string | null;
  Number_of_Children?: number | null;
  Spouse_Name?: string | null;
  Spouse_DOB?: string | null;
  Father_Name?: string | null;
  Emergency_Contact_Relationship?: string | null;
  Emergency_Contact_Number?: string | null;
  LinkedIn_URL?: string | null;
  Recruiter_Name?: string | null;
  Employment_End_Date?: string | null;
  Employment_End_Date_ISO?: string | null;
  Group_Name?: string | null;
  Group_Email?: string | null;
  Rejoined?: string | null;
  Key?: string | null;
  IBFT_IFT?: string | null;
  Slack_ID?: string | null;
  EOBI_Number?: string | null;
  Last_Month_Salary?: number | null;
  Increment_or_New_Addition?: number | null;
  Date_of_Increment?: string | null;
  Payable_From?: string | null;
  Other_Adjustments?: number | null; // Legacy name
  Additional_Points?: string | null;
  Shahzad_Comments?: string | null;
  AccountNumber?: string | null;
  Bank_Code?: string | null;
  Loaded_At?: string | null;
  Created_At?: string | null;
  Updated_At?: string | null;
}

export interface EOBIRecord {
  Payroll_Month: string | null; // Can be null from BigQuery
  Employee_ID: number | null; // INT64 - standardized numeric ID
  EMP_AREA_CODE: string;
  EMP_REG_SERIAL_NO: string;
  EMP_SUB_AREA_CODE: string;
  EMP_SUB_SERIAL_NO: string;
  NAME: string;
  EOBI_NO: string | null;
  CNIC: string | null;
  NIC: string | null;
  CNIC_clean: string | null;
  DOB: string | null;
  DOJ: string | null;
  DOE: string | null;
  NO_OF_DAYS_WORKED: number | null;
  From_Date: string | null;
  To_Date: string | null;
  Employee_Contribution: number | null;
  Employer_Contribution: number | null;
  Total_EOBI: number | null;
  Loaded_At: string | null;
}


