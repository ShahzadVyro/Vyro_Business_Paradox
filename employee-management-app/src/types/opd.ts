export interface OPDBenefitRecord {
  OPD_ID: number;
  Employee_ID: number;
  Benefit_Month: string; // DATE as ISO string
  Contribution_Amount: number | null;
  Claimed_Amount: number | null;
  Balance: number | null;
  Currency: string | null;
  Is_Active: boolean | null;
  Comments: string | null;
  Created_At: string | null;
  Updated_At: string | null;
  // Enriched fields from Employees join
  Full_Name?: string | null;
  Designation?: string | null;
  Department?: string | null;
}

export interface OPDBalance {
  Employee_ID: number;
  Total_Contributions: number;
  Total_Claimed: number;
  Available_Balance: number;
  Last_Contribution_Month: string | null;
  Last_Claim_Month: string | null;
}

export interface OPDFilters {
  month?: string;
  employeeId?: number;
  currency?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface OPDListResponse {
  rows: OPDBenefitRecord[];
  total: number;
  months: Array<{ value: string; label: string }>;
  activeMonth?: string;
}

