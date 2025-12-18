export type GenderOption = "Male" | "Female" | "Prefer not to say";
export type JobType = "Full Time" | "Part Time" | "Internship" | "Consultant";
export type JobLocation = "OnSite" | "Remote" | "Hybrid";
export type PreferredDevice = "MacBook" | "Windows";
export type ShirtSize = "S" | "M" | "L" | "XL";

export interface OnboardingFormInput {
  Full_Name: string;
  CNIC_ID: string;
  Personal_Email: string;
  Official_Email: string;
  Contact_Number: string;
  Date_of_Birth: string;
  Gender: GenderOption;
  Current_Address: string;
  Permanent_Address: string;
  Nationality: string;
  LinkedIn_URL?: string | null;
  Marital_Status: string;
  Age?: string | null;
  Number_of_Children?: string | null;
  Spouse_Name?: string | null;
  Spouse_DOB?: string | null;
  Joining_Date: string;
  Department: string;
  Designation: string;
  Reporting_Manager: string;
  Job_Type: JobType;
  Job_Location: JobLocation;
  Recruiter_Name: string;
  Preferred_Device: PreferredDevice;
  Employment_Location?: string | null;
  Father_Name: string;
  Emergency_Contact_Number: string;
  Emergency_Contact_Relationship: string;
  Blood_Group: string;
  Degree_Transcript_URL?: string | null;
  Last_Salary_Slip_URL?: string | null;
  Experience_Letter_URL?: string | null;
  Resume_URL?: string | null;
  Bank_Name: string;
  Bank_Account_Title: string;
  Bank_Account_Number_IBAN: string;
  Swift_Code_BIC: string;
  National_Tax_Number?: string | null;
  Passport_Photo_URL?: string | null;
  CNIC_Front_URL?: string | null;
  CNIC_Back_URL?: string | null;
  Vehicle_Number?: string | null;
  Introduction: string;
  Fun_Fact: string;
  Shirt_Size: ShirtSize;
}

export interface OnboardingSubmission extends OnboardingFormInput {
  Submission_ID: string;
  Status: "pending" | "confirmed" | "cancelled";
  Slack_TS?: string | null;
  Slack_Channel?: string | null;
  Approved_By?: string | null;
  Created_At: string;
  Updated_At: string;
  Employee_ID?: string | null;
}

