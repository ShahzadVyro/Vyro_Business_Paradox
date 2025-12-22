import "server-only";

/**
 * Calculate Revised with OPD (Only for USD employees)
 * Regular Pay + 21 if not in probation
 */
export function calculateRevisedWithOPD(
  regularPay: number | null,
  currency: string,
  isInProbation: boolean
): number | null {
  if (!regularPay || currency !== "USD" || isInProbation) {
    return regularPay;
  }
  return regularPay + 21;
}

/**
 * Calculate Prorated Pay
 * Formula: (Revised_with_OPD / total_days_in_month) * worked_days
 */
export function calculateProratedPay(
  revisedWithOPD: number | null,
  totalDaysInMonth: number,
  workedDays: number | null
): number | null {
  if (!revisedWithOPD || !workedDays || totalDaysInMonth === 0) {
    return null;
  }
  return (revisedWithOPD / totalDaysInMonth) * workedDays;
}

/**
 * Calculate Gross Income
 * Formula: Prorated_Pay + Performance_Bonus + Paid_Overtime + Reimbursements + Other + Payable_from_Last_Month
 */
export function calculateGrossIncome(
  proratedPay: number | null,
  performanceBonus: number | null,
  paidOvertime: number | null,
  reimbursements: number | null,
  other: number | null,
  payableFromLastMonth: number | null
): number {
  const values = [
    proratedPay ?? 0,
    performanceBonus ?? 0,
    paidOvertime ?? 0,
    reimbursements ?? 0,
    other ?? 0,
    payableFromLastMonth ?? 0,
  ];
  return values.reduce((sum, val) => sum + val, 0);
}

/**
 * Calculate Worked Days based on joining/leaving dates
 * - Normal employees: total days in month
 * - New hires: days from joining date to end of month (inclusive)
 * - Leavers: days from start of month to leaving date (inclusive)
 */
export function calculateWorkedDays(
  joiningDate: string | null | undefined,
  leavingDate: string | null | undefined,
  payrollMonth: string | Date
): number {
  // Parse payroll month
  const monthDate = typeof payrollMonth === "string" 
    ? new Date(payrollMonth) 
    : payrollMonth;
  
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  
  // Get first and last day of the month
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const totalDaysInMonth = lastDay.getDate();
  
  // If no joining or leaving date, assume full month
  if (!joiningDate && !leavingDate) {
    return totalDaysInMonth;
  }
  
  // Parse dates
  const joinDate = joiningDate ? new Date(joiningDate) : null;
  const leaveDate = leavingDate ? new Date(leavingDate) : null;
  
  // New hire: days from joining date to end of month
  if (joinDate && !leaveDate) {
    const joinMonth = joinDate.getMonth();
    const joinYear = joinDate.getFullYear();
    
    // If joining in a different month, return 0 (shouldn't happen but handle it)
    if (joinMonth !== month || joinYear !== year) {
      return totalDaysInMonth;
    }
    
    const joinDay = joinDate.getDate();
    return totalDaysInMonth - joinDay + 1; // Inclusive of joining date
  }
  
  // Leaver: days from start of month to leaving date
  if (leaveDate && !joinDate) {
    const leaveMonth = leaveDate.getMonth();
    const leaveYear = leaveDate.getFullYear();
    
    // If leaving in a different month, return full month
    if (leaveMonth !== month || leaveYear !== year) {
      return totalDaysInMonth;
    }
    
    const leaveDay = leaveDate.getDate();
    return leaveDay; // Inclusive of leaving date
  }
  
  // Both dates present: calculate days between
  if (joinDate && leaveDate) {
    const joinMonth = joinDate.getMonth();
    const joinYear = joinDate.getFullYear();
    const leaveMonth = leaveDate.getMonth();
    const leaveYear = leaveDate.getFullYear();
    
    // If both in same month
    if (joinMonth === month && joinYear === year && leaveMonth === month && leaveYear === year) {
      const joinDay = joinDate.getDate();
      const leaveDay = leaveDate.getDate();
      return leaveDay - joinDay + 1; // Inclusive
    }
    
    // If joining this month but leaving later
    if (joinMonth === month && joinYear === year) {
      const joinDay = joinDate.getDate();
      return totalDaysInMonth - joinDay + 1;
    }
    
    // If leaving this month but joined earlier
    if (leaveMonth === month && leaveYear === year) {
      const leaveDay = leaveDate.getDate();
      return leaveDay;
    }
  }
  
  // Default: full month
  return totalDaysInMonth;
}

/**
 * Get total days in a month
 */
export function getTotalDaysInMonth(payrollMonth: string | Date): number {
  const monthDate = typeof payrollMonth === "string" 
    ? new Date(payrollMonth) 
    : payrollMonth;
  
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  return lastDay.getDate();
}

/**
 * Get month abbreviation from date (Jan, Feb, etc.)
 */
export function getMonthAbbreviation(payrollMonth: string | Date): string {
  const monthDate = typeof payrollMonth === "string" 
    ? new Date(payrollMonth) 
    : payrollMonth;
  
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  
  return monthNames[monthDate.getMonth()];
}
