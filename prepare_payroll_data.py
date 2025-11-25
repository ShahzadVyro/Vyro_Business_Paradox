import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import pandas as pd
from google.cloud import bigquery

BASE_DIR = Path(__file__).resolve().parent
RAW_DIR = BASE_DIR / "RAWSheetData"
SALARY_FILE = RAW_DIR / "Salaries 24-26.xlsx"
EOBI_FILE = RAW_DIR / "EOBI updated data- AI (1).xlsx"

GOOGLE_APPLICATION_CREDENTIALS = (
    BASE_DIR / "Credentials" / "test-imagine-web-18d4f9a43aef.json"
)

PROJECT_ID = "test-imagine-web"
DATASET_ID = "Vyro_Business_Paradox"
SALARY_TABLE = "EmployeeSalaries_v1"
EOBI_TABLE = "EmployeeEOBI_v1"

MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
]

MONTH_ALIASES = {
    "january": 1,
    "jan": 1,
    "february": 2,
    "feb": 2,
    "march": 3,
    "mar": 3,
    "april": 4,
    "apr": 4,
    "may": 5,
    "june": 6,
    "jun": 6,
    "july": 7,
    "jul": 7,
    "august": 8,
    "aug": 8,
    "september": 9,
    "sept": 9,
    "sep": 9,
    "october": 10,
    "oct": 10,
    "november": 11,
    "nov": 11,
    "december": 12,
    "dec": 12,
}
MONTH_TOKEN_ORDER = sorted(MONTH_ALIASES.keys(), key=len, reverse=True)

def discover_salary_sheets() -> List[str]:
    xl = pd.ExcelFile(SALARY_FILE)
    pattern = re.compile(rf"^(PKR|USD)-((?:{'|'.join(MONTH_NAMES)})\s+\d{{4}})$", re.IGNORECASE)
    sheets: List[str] = []
    for name in xl.sheet_names:
        if "copy" in name.lower():
            continue
        if pattern.match(name):
            sheets.append(name)
    return sheets


def _eobi_priority(sheet_name: str) -> int:
    lower = sheet_name.lower()
    if "uploaded" in lower:
        return 0
    if "reference" in lower or "refrence" in lower:
        return 1
    return 2


def discover_eobi_sheets() -> List[str]:
    xl = pd.ExcelFile(EOBI_FILE)
    exclude = {"summary", "employees data", "emp_directory", "sheet36", "pr02a"}
    tokens = list(MONTH_ALIASES.keys())
    grouped: Dict[str, Tuple[str, int]] = {}

    for name in xl.sheet_names:
        lower = name.lower()
        if any(bad in lower for bad in exclude):
            continue
        if not any(token in lower for token in tokens):
            continue
        try:
            month_key = parse_eobi_month(name).strftime("%Y-%m")
        except ValueError:
            continue
        priority = _eobi_priority(name)
        existing = grouped.get(month_key)
        if existing is None or priority < existing[1]:
            grouped[month_key] = (name, priority)

    return [grouped[key][0] for key in sorted(grouped.keys())]


def normalize_emp_id(value) -> Optional[str]:
    if pd.isna(value):
        return None
    value = str(value).strip()
    if not value:
        return None
    if value.endswith(".0"):
        value = value[:-2]
    return value


def normalize_email(value) -> Optional[str]:
    if pd.isna(value):
        return None
    value = str(value).strip().lower()
    return value or None


def parse_month_from_sheet(sheet_name: str) -> Tuple[pd.Timestamp, str]:
    match = re.match(r"(USD|PKR)-(.*)", sheet_name)
    if not match:
        raise ValueError(f"Unexpected sheet name format: {sheet_name}")
    currency, month_label = match.groups()
    payroll_month = pd.to_datetime(month_label.strip(), format="%B %Y")
    return payroll_month, currency


def sanitize_column(name: str) -> str:
    name = str(name).strip()
    replacements = {
        " ": "_",
        "/": "_",
        "-": "_",
        "'": "",
        "(":
        "",
        ")": "",
    }
    for old, new in replacements.items():
        name = name.replace(old, new)
    name = re.sub(r"[^0-9A-Za-z_]", "", name)
    return name


def clean_cnic(value) -> Optional[str]:
    if pd.isna(value):
        return None
    digits = re.sub(r"[^0-9]", "", str(value))
    return digits or None


def load_employee_directory() -> pd.DataFrame:
    df = pd.read_excel(SALARY_FILE, sheet_name="Empl_Directory")
    rename_map = {
        "ID": "Employee_ID",
        "Name": "Employee_Name",
        "Status.1": "Employment_Status",
        "IBFT / IFT": "IBFT_IFT",
    }
    df = df.rename(columns=rename_map)
    df.columns = [col.strip() for col in df.columns]
    if "Slack ID" not in df.columns:
        df["Slack ID"] = None
    df["Employee_ID"] = df["Employee_ID"].apply(normalize_emp_id)
    df["Employee_Name"] = df["Employee_Name"].fillna("").str.strip()
    df["Official Email"] = df["Official Email"].apply(normalize_email)
    df["Personal Email"] = df["Personal Email"].apply(normalize_email)
    df["Key"] = df["Key"].fillna("").str.strip()
    df["Slack ID"] = df["Slack ID"].fillna("").str.strip()
    df["CNIC_clean"] = df["CNIC / ID"].apply(clean_cnic)
    return df


def load_salary_sheet(
    sheet_name: str,
    directory_df: pd.DataFrame,
) -> pd.DataFrame:
    payroll_month, currency = parse_month_from_sheet(sheet_name)
    df = pd.read_excel(SALARY_FILE, sheet_name=sheet_name)
    df.columns = [col.strip() for col in df.columns]
    df = df.rename(
        columns={
            "Employee ID": "Employee_ID",
            "Employee Name": "Employee_Name",
            "Email address": "Official_Email",
        }
    )
    if "Official_Email" not in df.columns:
        df["Official_Email"] = None
    df["Employee_ID"] = df["Employee_ID"].apply(normalize_emp_id)
    df["Official_Email"] = df["Official_Email"].apply(normalize_email)
    df["Payroll_Month"] = payroll_month.normalize()
    df["Currency"] = currency

    profile_subset = directory_df[
        [
            "Employee_ID",
            "Personal Email",
            "Official Email",
            "Joining Date",
            "Designation",
            "Department",
            "Reporting Manager",
            "Job Type",
            "Status",
            "Probation Period",
            "Probation End Date",
            "Basic Salary",
            "Medical",
            "Gross Salary",
            "Contact Number",
            "CNIC / ID",
            "Gender",
            "Bank Name",
            "Bank Account Title",
            "Bank Account Number-IBAN (24 digits)",
            "Swift Code/ BIC Code",
            "Routing Number",
            "Employment Location",
            "Date of Birth",
            "Age",
            "Address",
            "Nationality",
            "Marital Status",
            "Number of Children",
            "Spouse - Name",
            "Spouse DOB",
            "Father's Name",
            "Emergency Contact's Relationship",
            "Emergency Contact Number",
            "Blood Group",
            "LinkedIn URL",
            "Recruiter Name",
            "Employment End Date",
            "Group Name",
            "Group Email",
            "Re-Joined",
            "Employment_Status",
            "Key",
            "IBFT_IFT",
            "Slack ID",
            "EOBI_NO",
        ]
    ].rename(
        columns={
            "Personal Email": "Personal_Email",
            "Official Email": "Official_Email_Profile",
            "Joining Date": "Joining_Date",
            "Reporting Manager": "Reporting_Manager",
            "Job Type": "Job_Type",
            "Status": "Status_Directory",
            "Probation Period": "Probation_Period",
            "Probation End Date": "Probation_End_Date",
            "Contact Number": "Contact_Number",
            "CNIC / ID": "CNIC_ID",
            "Bank Name": "Bank_Name",
            "Bank Account Title": "Bank_Account_Title",
            "Bank Account Number-IBAN (24 digits)": "Bank_Account_IBAN",
            "Swift Code/ BIC Code": "Swift_Code_BIC",
            "Routing Number": "Routing_Number",
            "Employment Location": "Employment_Location",
            "Date of Birth": "Date_of_Birth",
            "Marital Status": "Marital_Status",
            "Number of Children": "Number_of_Children",
            "Spouse - Name": "Spouse_Name",
            "Spouse DOB": "Spouse_DOB",
            "Emergency Contact's Relationship": "Emergency_Contact_Relationship",
            "Emergency Contact Number": "Emergency_Contact_Number",
            "Recruiter Name": "Recruiter_Name",
            "Employment End Date": "Employment_End_Date",
            "Group Name": "Group_Name",
            "Group Email": "Group_Email",
            "Re-Joined": "Rejoined",
            "Employment_Status": "Employment_Status",
            "IBFT_IFT": "IBFT_IFT",
            "Slack ID": "Slack_ID",
            "EOBI_NO": "EOBI_Number",
        }
    )

    merged = df.merge(profile_subset, on="Employee_ID", how="left")

    # prefer directory email if available
    merged["Official_Email"] = merged["Official_Email_Profile"].combine_first(
        merged["Official_Email"]
    )
    merged = merged.drop(columns=["Official_Email_Profile"])

    numeric_cols = [
        "Basic Salary",
        "Medical",
        "Gross Salary",
        "Worked Days",
        "Last Months's Salary",
        "Increment/ New Addition",
        "Regular Pay",
        "Prorated Pay",
        "Prorated Base Pay",
        "Prorated Medical Allowance",
        "Prorated Transport Allowance ",
        "Prorated Inflation Allowance ",
        "Performance Bonus",
        "Paid Overtime",
        "Reimbursements",
        "Other",
        "Taxable Income",
        "Gross Income",
        "Unpaid Leaves/days",
        "Tax deduction",
        "EOBI",
        "Loan deduction",
        "Recoveries ",
        "Deductions",
        "Net Income",
    ]
    for column in numeric_cols:
        if column in merged.columns:
            merged[column] = pd.to_numeric(merged[column], errors="coerce")

    merged = merged.rename(
        columns={
            "Employee_Name": "Employee_Name",
            "Personal_Email": "Personal_Email",
            "Official_Email": "Official_Email",
            "Joining_Date": "Joining_Date",
            "Designation": "Designation",
            "Department": "Department",
            "Reporting_Manager": "Reporting_Manager",
            "Job_Type": "Job_Type",
            "Status_Directory": "Status_Directory",
            "Probation_Period": "Probation_Period",
            "Probation_End_Date": "Probation_End_Date",
            "Basic Salary": "Basic_Salary",
            "Medical": "Medical",
            "Gross Salary": "Gross_Salary",
            "Contact_Number": "Contact_Number",
            "CNIC_ID": "CNIC_ID",
            "Bank_Name": "Bank_Name",
            "Bank_Account_Title": "Bank_Account_Title",
            "Bank_Account_IBAN": "Bank_Account_IBAN",
            "Swift_Code_BIC": "Swift_Code_BIC",
            "Routing_Number": "Routing_Number",
            "Employment_Location": "Employment_Location",
            "Date_of_Birth": "Date_of_Birth",
            "Address": "Address",
            "Nationality": "Nationality",
            "Marital_Status": "Marital_Status",
            "Number_of_Children": "Number_of_Children",
            "Spouse_Name": "Spouse_Name",
            "Spouse_DOB": "Spouse_DOB",
            "Father's Name": "Father_Name",
            "Emergency_Contact_Relationship": "Emergency_Contact_Relationship",
            "Emergency_Contact_Number": "Emergency_Contact_Number",
            "Blood Group": "Blood_Group",
            "LinkedIn URL": "LinkedIn_URL",
            "Recruiter_Name": "Recruiter_Name",
            "Employment_End_Date": "Employment_End_Date",
            "Group_Name": "Group_Name",
            "Group_Email": "Group_Email",
            "Rejoined": "Rejoined",
            "Employment_Status": "Employment_Status",
            "Key": "Key",
            "IBFT_IFT": "IBFT_IFT",
            "Slack_ID": "Slack_ID",
            "EOBI_Number": "EOBI_Number",
            "Worked Days": "Worked_Days",
            "Last Months's Salary": "Last_Month_Salary",
            "Increment/ New Addition": "Increment_or_New_Addition",
            "Date of Increment": "Date_of_Increment",
            "Payable from Last/Next Month": "Payable_From",
            "Regular Pay": "Regular_Pay",
            "Prorated Pay": "Prorated_Pay",
            "Prorated Base Pay": "Prorated_Base_Pay",
            "Prorated Medical Allowance": "Prorated_Medical_Allowance",
            "Prorated Transport Allowance ": "Prorated_Transport_Allowance",
            "Prorated Inflation Allowance ": "Prorated_Inflation_Allowance",
            "Performance Bonus": "Performance_Bonus",
            "Paid Overtime": "Paid_Overtime",
            "Reimbursements": "Reimbursements",
            "Other": "Other_Adjustments",
            "Taxable Income": "Taxable_Income",
            "Gross Income": "Gross_Income",
            "Unpaid Leaves/days": "Unpaid_Leaves",
            "Tax deduction": "Tax_Deduction",
            "EOBI": "EOBI",
            "Loan deduction": "Loan_Deduction",
            "Recoveries ": "Recoveries",
            "Deductions": "Deductions",
            "Net Income": "Net_Income",
            "Comments": "Comments",
            "Additional points": "Additional_Points",
            "Shahzad Comments": "Shahzad_Comments",
        }
    )

    merged.columns = [sanitize_column(col) for col in merged.columns]

    if "Employment_Status" in merged.columns:
        merged["Status"] = merged["Employment_Status"]

    expected_columns = [
        "Payroll_Month",
        "Currency",
        "Employee_ID",
        "Employee_Name",
        "Personal_Email",
        "Official_Email",
        "Joining_Date",
        "Designation",
        "Department",
        "Reporting_Manager",
        "Job_Type",
        "Status",
        "Employment_Status",
        "Probation_Period",
        "Probation_End_Date",
        "Basic_Salary",
        "Medical",
        "Gross_Salary",
        "Contact_Number",
        "CNIC_ID",
        "Gender",
        "Bank_Name",
        "Bank_Account_Title",
        "Bank_Account_IBAN",
        "Swift_Code_BIC",
        "Routing_Number",
        "Employment_Location",
        "Date_of_Birth",
        "Age",
        "Address",
        "Nationality",
        "Marital_Status",
        "Number_of_Children",
        "Spouse_Name",
        "Spouse_DOB",
        "Father_Name",
        "Emergency_Contact_Relationship",
        "Emergency_Contact_Number",
        "Blood_Group",
        "LinkedIn_URL",
        "Recruiter_Name",
        "Employment_End_Date",
        "Group_Name",
        "Group_Email",
        "Rejoined",
        "Key",
        "IBFT_IFT",
        "Slack_ID",
        "EOBI_Number",
        "Worked_Days",
        "Last_Month_Salary",
        "Increment_or_New_Addition",
        "Date_of_Increment",
        "Payable_From",
        "Regular_Pay",
        "Prorated_Pay",
        "Prorated_Base_Pay",
        "Prorated_Medical_Allowance",
        "Prorated_Transport_Allowance",
        "Prorated_Inflation_Allowance",
        "Performance_Bonus",
        "Paid_Overtime",
        "Reimbursements",
        "Other_Adjustments",
        "Taxable_Income",
        "Gross_Income",
        "Unpaid_Leaves",
        "Tax_Deduction",
        "EOBI",
        "Loan_Deduction",
        "Recoveries",
        "Deductions",
        "Net_Income",
        "Comments",
        "Additional_Points",
        "Shahzad_Comments",
        "AccountNumber",
        "Bank_Code",
    ]
    for column in expected_columns:
        if column not in merged.columns:
            merged[column] = None

    merged = merged[expected_columns]

    date_columns = [
        "Payroll_Month",
        "Joining_Date",
        "Probation_End_Date",
        "Employment_End_Date",
        "Date_of_Birth",
        "Spouse_DOB",
        "Date_of_Increment",
    ]
    for column in date_columns:
        if column in merged.columns:
            merged[column] = pd.to_datetime(merged[column], errors="coerce").dt.date
    if "Number_of_Children" in merged.columns:
        merged["Number_of_Children"] = pd.to_numeric(
            merged["Number_of_Children"], errors="coerce"
        )

    string_fields = [
        "Status",
        "Contact_Number",
        "Emergency_Contact_Number",
        "Bank_Account_IBAN",
        "Routing_Number",
        "CNIC_ID",
        "Bank_Name",
        "Bank_Account_Title",
        "IBFT_IFT",
        "Slack_ID",
        "AccountNumber",
        "Bank_Code",
        "Key",
        "Personal_Email",
        "Official_Email",
        "Comments",
        "Additional_Points",
        "Shahzad_Comments",
    ]
    for column in string_fields:
        if column in merged.columns:
            merged[column] = merged[column].apply(
                lambda value: str(value).strip() if pd.notna(value) else None
            )

    return merged


def load_salary_data(directory_df: pd.DataFrame, sheet_names: List[str]) -> pd.DataFrame:
    frames = [load_salary_sheet(sheet, directory_df) for sheet in sheet_names]
    salary_df = pd.concat(frames, ignore_index=True)
    salary_df["Key"] = salary_df["Key"].fillna("").str.strip()
    return salary_df


def parse_eobi_month(sheet_name: str) -> pd.Timestamp:
    lower = sheet_name.lower()
    month = None
    year = None
    for token in MONTH_TOKEN_ORDER:
        if token in lower:
            month = MONTH_ALIASES[token]
            remainder = lower[lower.index(token) + len(token) :]
            year_match = re.search(r"(\d{2,4})", remainder)
            if year_match:
                year = int(year_match.group(1))
            break
    if month is None:
        raise ValueError(f"Cannot parse month from EOBI sheet {sheet_name}")
    if year is None:
        year_match = re.search(r"(\d{2,4})", lower)
        if year_match:
            year = int(year_match.group(1))
    if year is None:
        raise ValueError(f"Cannot parse month from EOBI sheet {sheet_name}")
    if year < 100:
        year += 2000
    return pd.Timestamp(year=year, month=month, day=1)


def load_eobi_sheet(sheet_name: str) -> pd.DataFrame:
    df = pd.read_excel(EOBI_FILE, sheet_name=sheet_name)
    df.columns = [sanitize_column(col) for col in df.columns]
    payroll_month = parse_eobi_month(sheet_name)
    df["Payroll_Month"] = payroll_month.normalize()
    defaults = {
        "EMP_AREA_CODE": "FAA",
        "EMP_REG_SERIAL_NO": "4320",
        "EMP_SUB_AREA_CODE": " ",
        "EMP_SUB_SERIAL_NO": "0",
    }
    for column, value in defaults.items():
        if column in df.columns:
            df[column] = df[column].fillna(value)
        else:
            df[column] = value
    for column in ["From_Date", "To_Date", "DOB", "DOJ", "DOE"]:
        if column in df.columns:
            df[column] = pd.to_datetime(df[column], errors="coerce").dt.date
    for column in ["Employee_Contribution", "Employer_Contribution", "Total_EOBI"]:
        if column in df.columns:
            df[column] = pd.to_numeric(df[column], errors="coerce")
    expected_columns = [
        "EMP_AREA_CODE",
        "EMP_REG_SERIAL_NO",
        "EMP_SUB_AREA_CODE",
        "EMP_SUB_SERIAL_NO",
        "NAME",
        "EOBI_NO",
        "CNIC",
        "NIC",
        "DOB",
        "DOJ",
        "DOE",
        "NO_OF_DAYS_WORKED",
        "From_Date",
        "To_Date",
        "Employee_Contribution",
        "Employer_Contribution",
        "Total_EOBI",
        "Payroll_Month",
    ]
    for column in expected_columns:
        if column not in df.columns:
            df[column] = None

    df = df[expected_columns]

    df["Payroll_Month"] = pd.to_datetime(df["Payroll_Month"]).dt.date
    df["CNIC_clean"] = df["CNIC"].apply(clean_cnic)
    df["NO_OF_DAYS_WORKED"] = pd.to_numeric(df["NO_OF_DAYS_WORKED"], errors="coerce")
    df["Employee_Contribution"] = pd.to_numeric(df["Employee_Contribution"], errors="coerce")
    df["Employer_Contribution"] = pd.to_numeric(df["Employer_Contribution"], errors="coerce")
    df["Total_EOBI"] = pd.to_numeric(df["Total_EOBI"], errors="coerce")
    string_columns = [
        "EMP_AREA_CODE",
        "EMP_REG_SERIAL_NO",
        "EMP_SUB_AREA_CODE",
        "EMP_SUB_SERIAL_NO",
        "NAME",
        "EOBI_NO",
        "CNIC",
        "NIC",
        "CNIC_clean",
    ]
    for column in string_columns:
        if column in df.columns:
            df[column] = df[column].apply(
                lambda value: str(value).strip() if pd.notna(value) else None
            )
    return df


def load_eobi_data(directory_df: pd.DataFrame, sheet_names: List[str]) -> pd.DataFrame:
    frames = [load_eobi_sheet(sheet) for sheet in sheet_names]
    eobi_df = pd.concat(frames, ignore_index=True)
    eobi_df = eobi_df.merge(
        directory_df[["Employee_ID", "CNIC_clean"]],
        on="CNIC_clean",
        how="left",
    )
    eobi_df = eobi_df.rename(columns={"Employee_ID": "Employee_ID"})
    return eobi_df


def load_to_bigquery(df: pd.DataFrame, table_id: str):
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(GOOGLE_APPLICATION_CREDENTIALS)
    client = bigquery.Client(project=PROJECT_ID)
    table_ref = f"{PROJECT_ID}.{DATASET_ID}.{table_id}"
    job_config = bigquery.LoadJobConfig(write_disposition="WRITE_TRUNCATE")
    job = client.load_table_from_dataframe(df, table_ref, job_config=job_config)
    job.result()


def main():
    directory_df = load_employee_directory()
    salary_sheets = sorted(
        discover_salary_sheets(),
        key=lambda name: parse_month_from_sheet(name)[0],
    )
    eobi_sheets = sorted(
        discover_eobi_sheets(),
        key=lambda name: parse_eobi_month(name),
    )

    print(f"Discovered {len(salary_sheets)} salary sheets and {len(eobi_sheets)} EOBI sheets")

    salaries_df = load_salary_data(directory_df, salary_sheets)
    eobi_df = load_eobi_data(directory_df, eobi_sheets)

    load_to_bigquery(salaries_df, SALARY_TABLE)
    load_to_bigquery(eobi_df, EOBI_TABLE)

    print("Loaded records:")
    print(f"- Salaries: {len(salaries_df)} rows")
    print(f"- EOBI: {len(eobi_df)} rows")


if __name__ == "__main__":
    main()

