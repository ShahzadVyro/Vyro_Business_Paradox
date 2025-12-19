import type { EmployeeRecord } from "@/types/employee";

/**
 * Converts a date string from YYYY-MM-DD format to DD-MMM-YY format for EOBI portal
 * @param date - Date string in YYYY-MM-DD format or null
 * @returns Date string in DD-MMM-YY format (e.g., "12-Dec-22") or empty string if null
 */
export function formatDateForEOBI(date: string | null | undefined): string {
  if (!date) return "";

  try {
    // Handle various date formats
    let dateObj: Date;
    
    if (date.includes("-")) {
      // YYYY-MM-DD format
      dateObj = new Date(date);
    } else if (date.includes("/")) {
      // MM/DD/YYYY format
      const parts = date.split("/");
      dateObj = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
    } else {
      // Try parsing as-is
      dateObj = new Date(date);
    }

    if (isNaN(dateObj.getTime())) {
      return "";
    }

    const day = dateObj.getDate().toString().padStart(2, "0");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = monthNames[dateObj.getMonth()];
    const year = dateObj.getFullYear().toString().slice(-2);

    return `${day}-${month}-${year}`;
  } catch {
    return "";
  }
}

/**
 * Calculates the number of days worked in a given month for an employee
 * @param employee - Employee record
 * @param monthStart - First day of the month
 * @param monthEnd - Last day of the month
 * @returns Number of days worked (0 for resigned/terminated employees)
 */
export function calculateDaysWorked(
  employee: EmployeeRecord,
  monthStart: Date,
  monthEnd: Date
): number {
  // Parse employment end date if available
  let employmentEndDate: Date | null = null;
  if (employee.Employment_End_Date) {
    try {
      employmentEndDate = new Date(employee.Employment_End_Date);
      if (isNaN(employmentEndDate.getTime())) {
        employmentEndDate = null;
      }
    } catch {
      employmentEndDate = null;
    }
  }

  // If employee resigned before the month started, return 0
  if (employmentEndDate && employmentEndDate < monthStart) {
    return 0;
  }

  // If employee resigned during the month, calculate days from month start to end date (inclusive)
  // This applies regardless of status - if they worked during the month, they get partial days
  if (employmentEndDate && employmentEndDate >= monthStart && employmentEndDate <= monthEnd) {
    const diffTime = employmentEndDate.getTime() - monthStart.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end day
    return Math.max(0, diffDays);
  }

  // Check status for employees who resigned but don't have an end date set, or end date is after the month
  const status = employee.Employment_Status?.toUpperCase().trim();
  const isResigned = status === "RESIGNED/TERMINATED" || status === "RESIGNED" || status === "TERMINATED";
  
  // If employee is resigned/terminated but no end date or end date is after the month, return 0
  // (This handles cases where status is resigned but end date is not set or is in future)
  if (isResigned && (!employmentEndDate || employmentEndDate > monthEnd)) {
    return 0;
  }

  // Parse joining date
  let joiningDate: Date | null = null;
  if (employee.Joining_Date) {
    try {
      joiningDate = new Date(employee.Joining_Date);
      if (isNaN(joiningDate.getTime())) {
        joiningDate = null;
      }
    } catch {
      joiningDate = null;
    }
  }

  // If employee joined during the month, calculate days from joining date to month end
  if (joiningDate && joiningDate > monthStart && joiningDate <= monthEnd) {
    const diffTime = monthEnd.getTime() - joiningDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end day
    return Math.max(0, diffDays);
  }

  // If employee joined before the month and is still active, return full month days
  if (joiningDate && joiningDate <= monthStart) {
    // Calculate days in month
    const year = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return daysInMonth;
  }

  // Default: return full month days for active employees
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return daysInMonth;
}

/**
 * Gets the first and last day of a month from a date string
 * @param month - Month string in YYYY-MM format or YYYY-MM-DD format
 * @returns Object with monthStart and monthEnd Date objects
 */
export function getMonthBounds(month: string): { monthStart: Date; monthEnd: Date } {
  let year: number;
  let monthIndex: number;

  if (month.includes("-")) {
    const parts = month.split("-");
    year = parseInt(parts[0]);
    monthIndex = parseInt(parts[1]) - 1; // JavaScript months are 0-indexed
  } else {
    // Try parsing as full date
    const date = new Date(month);
    year = date.getFullYear();
    monthIndex = date.getMonth();
  }

  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0); // Last day of month

  return { monthStart, monthEnd };
}

/**
 * Determines if a CNIC is in new format (5 digits - 7 digits - 1 digit)
 * @param cnic - CNIC string
 * @returns true if new format, false if old format
 */
export function isNewNICFormat(cnic: string | null | undefined): boolean {
  if (!cnic) return false;
  // Remove dashes and spaces
  const cleaned = cnic.replace(/[-\s]/g, "");
  // New format: 13 digits total, pattern: 5-7-1
  // Old format: 15 digits total, pattern: 5-7-3
  return cleaned.length === 13;
}

/**
 * Gets relationship code from employee data
 * Defaults to "F" for Father if Father_Name exists
 * @param employee - Employee record
 * @returns Relationship code (F, M, S, D, etc.)
 */
export function getRelationshipCode(employee: EmployeeRecord | { Father_Name?: string | null }): string {
  // Default to "F" (Father) if Father_Name exists
  // This can be extended based on Emergency_Contact_Relationship field if available
  if ((employee as any).Father_Name) {
    return "F";
  }
  // Default fallback
  return "F";
}
