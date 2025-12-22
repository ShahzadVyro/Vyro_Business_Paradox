"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SalaryRecord } from "@/types/api/payroll";
import type { EmployeeRecord } from "@/types/employee";

interface EmployeeSalaryComponentsFormProps {
  employee: EmployeeRecord;
  onCancel: () => void;
}

const formatCurrency = (value: number | null | undefined, currency: string = "PKR") => {
  if (value === null || value === undefined) return "";
  const resolvedCurrency = currency === "USD" ? "USD" : "PKR";
  return new Intl.NumberFormat(resolvedCurrency === "USD" ? "en-US" : "en-PK", {
    style: "currency",
    currency: resolvedCurrency,
    maximumFractionDigits: 0,
  }).format(value);
};

const fetchSalaryHistory = async (employeeId: number, currency?: string) => {
  const params = new URLSearchParams({ employeeId: String(employeeId) });
  if (currency) params.append("currency", currency);
  const response = await fetch(`/api/salaries/history?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch salary history");
  }
  return response.json();
};

const fetchLatestSalary = async (employeeId: number) => {
  const response = await fetch(`/api/employees/${employeeId}/salary`);
  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error("Failed to fetch salary");
  }
  return response.json();
};

const updateSalary = async (salaryId: number, updates: Partial<SalaryRecord>) => {
  const response = await fetch(`/api/salaries/${salaryId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update salary");
  }
  return response.json();
};

export default function EmployeeSalaryComponentsForm({ employee, onCancel }: EmployeeSalaryComponentsFormProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<"USD" | "PKR">("PKR");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [formData, setFormData] = useState<Partial<SalaryRecord>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: latestSalary, isLoading: isLoadingSalary } = useQuery({
    queryKey: ["employee-salary", employee.Employee_ID, selectedCurrency],
    queryFn: () => fetchLatestSalary(employee.Employee_ID!),
    enabled: !!employee.Employee_ID,
  });

  const { data: salaryHistory, isLoading: isLoadingHistory } = useQuery({
    queryKey: ["employee-salary-history", employee.Employee_ID, selectedCurrency],
    queryFn: () => fetchSalaryHistory(employee.Employee_ID!, selectedCurrency),
    enabled: !!employee.Employee_ID,
  });

  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: ({ salaryId, updates }: { salaryId: number; updates: Partial<SalaryRecord> }) =>
      updateSalary(salaryId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-salary", employee.Employee_ID] });
      queryClient.invalidateQueries({ queryKey: ["employee-salary-history", employee.Employee_ID] });
      setIsEditing(false);
      alert("Salary updated successfully");
    },
    onError: (error: Error) => {
      alert(`Failed to update: ${error.message}`);
    },
  });

  useEffect(() => {
    if (latestSalary) {
      setFormData({
        Regular_Pay: latestSalary.Regular_Pay,
        Prorated_Pay: latestSalary.Prorated_Pay,
        Performance_Bonus: latestSalary.Performance_Bonus,
        Paid_Overtime: latestSalary.Paid_Overtime,
        Reimbursements: latestSalary.Reimbursements,
        Other: latestSalary.Other,
        Unpaid_Leaves: latestSalary.Unpaid_Leaves,
        Deductions: latestSalary.Deductions,
        Comments: latestSalary.Comments,
        Internal_Comments: latestSalary.Internal_Comments,
        Salary_Status: latestSalary.Salary_Status,
        PaySlip_Status: latestSalary.PaySlip_Status,
        Payable_from_Last_Month: latestSalary.Payable_from_Last_Month,
        // PKR-specific fields
        Prorated_Base_Pay: latestSalary.Prorated_Base_Pay,
        Prorated_Medical_Allowance: latestSalary.Prorated_Medical_Allowance,
        Prorated_Transport_Allowance: latestSalary.Prorated_Transport_Allowance,
        Prorated_Inflation_Allowance: latestSalary.Prorated_Inflation_Allowance,
        Taxable_Income: latestSalary.Taxable_Income,
        Tax_Deduction: latestSalary.Tax_Deduction,
        EOBI: latestSalary.EOBI,
        Loan_Deduction: latestSalary.Loan_Deduction,
        Recoveries: latestSalary.Recoveries,
      });
    }
  }, [latestSalary]);

  const handleSave = async () => {
    if (!latestSalary?.Salary_ID) {
      alert("Cannot update: Salary record not found");
      return;
    }

    setSaving(true);
    try {
      await updateMutation.mutateAsync({
        salaryId: latestSalary.Salary_ID,
        updates: formData,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (field: keyof SalaryRecord, value: number | string | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isPKR = selectedCurrency === "PKR";
  const currentSalary = latestSalary as SalaryRecord | null;

  if (isLoadingSalary) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-400">
        Loading salary data...
      </div>
    );
  }

  if (!currentSalary) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center">
        <p className="text-slate-600 mb-4">No salary record found for this employee.</p>
        <p className="text-sm text-slate-500">Salary records are created through the payroll system.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Currency and Month Selectors */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-semibold text-slate-900 mb-1">Currency</label>
          <select
            value={selectedCurrency}
            onChange={(e) => setSelectedCurrency(e.target.value as "USD" | "PKR")}
            className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
          >
            <option value="PKR">PKR</option>
            <option value="USD">USD</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-semibold text-slate-900 mb-1">Payroll Month</label>
          <input
            type="month"
            value={currentSalary.Payroll_Month ? currentSalary.Payroll_Month.substring(0, 7) : ""}
            readOnly
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm"
          />
        </div>
      </div>

      {/* Salary History */}
      {salaryHistory && salaryHistory.length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-slate-900 mb-2">Salary History</label>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 max-h-40 overflow-y-auto">
            <div className="space-y-2 text-xs">
              {salaryHistory.map((record: SalaryRecord) => (
                <div key={record.Salary_ID} className="flex justify-between items-center">
                  <span className="text-slate-600">
                    {record.Payroll_Month ? new Date(record.Payroll_Month).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "—"}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(record.Net_Income, record.Currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Salary Components Form */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Salary Components</h3>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700"
            >
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  // Reset form data
                  if (latestSalary) {
                    setFormData({
                      Regular_Pay: latestSalary.Regular_Pay,
                      Prorated_Pay: latestSalary.Prorated_Pay,
                      Performance_Bonus: latestSalary.Performance_Bonus,
                      Paid_Overtime: latestSalary.Paid_Overtime,
                      Reimbursements: latestSalary.Reimbursements,
                      Other: latestSalary.Other,
                      Unpaid_Leaves: latestSalary.Unpaid_Leaves,
                      Deductions: latestSalary.Deductions,
                      Comments: latestSalary.Comments,
                      Internal_Comments: latestSalary.Internal_Comments,
                      Salary_Status: latestSalary.Salary_Status,
                      PaySlip_Status: latestSalary.PaySlip_Status,
                      Payable_from_Last_Month: latestSalary.Payable_from_Last_Month,
                    });
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Regular Pay */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">Regular Pay</label>
            {isEditing ? (
              <input
                type="number"
                value={formData.Regular_Pay ?? ""}
                onChange={(e) => handleFieldChange("Regular_Pay", e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
                step="0.01"
              />
            ) : (
              <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
                {formatCurrency(formData.Regular_Pay, currentSalary.Currency)}
              </div>
            )}
          </div>

          {/* Revised with OPD (USD only) */}
          {currentSalary.Currency === "USD" && (
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-1">Revised with OPD</label>
              <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
                {formatCurrency(currentSalary.Revised_with_OPD, currentSalary.Currency)}
              </div>
            </div>
          )}

          {/* Prorated Pay */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">Prorated Pay</label>
            {isEditing ? (
              <input
                type="number"
                value={formData.Prorated_Pay ?? ""}
                onChange={(e) => handleFieldChange("Prorated_Pay", e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
                step="0.01"
              />
            ) : (
              <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
                {formatCurrency(formData.Prorated_Pay, currentSalary.Currency)}
              </div>
            )}
          </div>

          {/* Performance Bonus */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">Performance Bonus</label>
            {isEditing ? (
              <input
                type="number"
                value={formData.Performance_Bonus ?? ""}
                onChange={(e) => handleFieldChange("Performance_Bonus", e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
                step="0.01"
              />
            ) : (
              <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
                {formatCurrency(formData.Performance_Bonus, currentSalary.Currency)}
              </div>
            )}
          </div>

          {/* Paid Overtime */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">Paid Overtime</label>
            {isEditing ? (
              <input
                type="number"
                value={formData.Paid_Overtime ?? ""}
                onChange={(e) => handleFieldChange("Paid_Overtime", e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
                step="0.01"
              />
            ) : (
              <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
                {formatCurrency(formData.Paid_Overtime, currentSalary.Currency)}
              </div>
            )}
          </div>

          {/* Reimbursements */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">Reimbursements</label>
            {isEditing ? (
              <input
                type="number"
                value={formData.Reimbursements ?? ""}
                onChange={(e) => handleFieldChange("Reimbursements", e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
                step="0.01"
              />
            ) : (
              <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
                {formatCurrency(formData.Reimbursements, currentSalary.Currency)}
              </div>
            )}
          </div>

          {/* Other */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">Other</label>
            {isEditing ? (
              <input
                type="number"
                value={formData.Other ?? ""}
                onChange={(e) => handleFieldChange("Other", e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
                step="0.01"
              />
            ) : (
              <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
                {formatCurrency(formData.Other, currentSalary.Currency)}
              </div>
            )}
          </div>

          {/* Gross Income - Read-only */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">Gross Income</label>
            <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold">
              {formatCurrency(currentSalary.Gross_Income, currentSalary.Currency)}
            </div>
            <p className="mt-1 text-xs text-slate-500">Calculated automatically</p>
          </div>

          {/* Unpaid Leaves */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">Unpaid Leaves</label>
            {isEditing ? (
              <input
                type="number"
                value={formData.Unpaid_Leaves ?? ""}
                onChange={(e) => handleFieldChange("Unpaid_Leaves", e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
                step="0.01"
              />
            ) : (
              <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
                {formData.Unpaid_Leaves ?? "—"}
              </div>
            )}
          </div>

          {/* Deductions */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">Deductions</label>
            {isEditing ? (
              <input
                type="number"
                value={formData.Deductions ?? ""}
                onChange={(e) => handleFieldChange("Deductions", e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
                step="0.01"
              />
            ) : (
              <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
                {formatCurrency(formData.Deductions, currentSalary.Currency)}
              </div>
            )}
          </div>

          {/* Net Income - Read-only */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">Net Income</label>
            <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold">
              {formatCurrency(currentSalary.Net_Income, currentSalary.Currency)}
            </div>
            <p className="mt-1 text-xs text-slate-500">Calculated automatically</p>
          </div>

          {/* Payable from Last Month */}
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">Payable from Last Month</label>
            {isEditing ? (
              <input
                type="number"
                value={formData.Payable_from_Last_Month ?? ""}
                onChange={(e) => handleFieldChange("Payable_from_Last_Month", e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
                step="0.01"
              />
            ) : (
              <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
                {formatCurrency(formData.Payable_from_Last_Month, currentSalary.Currency)}
              </div>
            )}
          </div>
        </div>

        {/* PKR-specific fields */}
        {isPKR && (
          <div className="mt-6 pt-6 border-t border-slate-200">
            <h4 className="text-md font-semibold text-slate-900 mb-4">PKR-Specific Fields</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1">Prorated Base Pay</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.Prorated_Base_Pay ?? ""}
                    onChange={(e) => handleFieldChange("Prorated_Base_Pay", e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
                    step="0.01"
                  />
                ) : (
                  <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
                    {formatCurrency(formData.Prorated_Base_Pay, "PKR")}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1">Prorated Medical Allowance</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.Prorated_Medical_Allowance ?? ""}
                    onChange={(e) => handleFieldChange("Prorated_Medical_Allowance", e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
                    step="0.01"
                  />
                ) : (
                  <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
                    {formatCurrency(formData.Prorated_Medical_Allowance, "PKR")}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1">Prorated Transport Allowance</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.Prorated_Transport_Allowance ?? ""}
                    onChange={(e) => handleFieldChange("Prorated_Transport_Allowance", e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
                    step="0.01"
                  />
                ) : (
                  <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
                    {formatCurrency(formData.Prorated_Transport_Allowance, "PKR")}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1">Prorated Inflation Allowance</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.Prorated_Inflation_Allowance ?? ""}
                    onChange={(e) => handleFieldChange("Prorated_Inflation_Allowance", e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
                    step="0.01"
                  />
                ) : (
                  <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
                    {formatCurrency(formData.Prorated_Inflation_Allowance, "PKR")}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1">Tax Deduction</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.Tax_Deduction ?? ""}
                    onChange={(e) => handleFieldChange("Tax_Deduction", e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
                    step="0.01"
                  />
                ) : (
                  <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
                    {formatCurrency(formData.Tax_Deduction, "PKR")}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-1">EOBI</label>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.EOBI ?? ""}
                    onChange={(e) => handleFieldChange("EOBI", e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
                    step="0.01"
                  />
                ) : (
                  <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
                    {formatCurrency(formData.EOBI, "PKR")}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Status Fields */}
        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-slate-200">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">Salary Status</label>
            {isEditing ? (
              <select
                value={formData.Salary_Status || "HOLD"}
                onChange={(e) => handleFieldChange("Salary_Status", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
              >
                <option value="Released">Released</option>
                <option value="HOLD">HOLD</option>
              </select>
            ) : (
              <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
                {formData.Salary_Status || "HOLD"}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-1">Payslip Status</label>
            {isEditing ? (
              <select
                value={formData.PaySlip_Status || "Not Sent"}
                onChange={(e) => handleFieldChange("PaySlip_Status", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
              >
                <option value="Sent">Sent</option>
                <option value="Not Sent">Not Sent</option>
              </select>
            ) : (
              <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
                {formData.PaySlip_Status || "Not Sent"}
              </div>
            )}
          </div>
        </div>

        {/* Comments */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <label className="block text-sm font-semibold text-slate-900 mb-1">Comments</label>
          {isEditing ? (
            <textarea
              value={formData.Comments || ""}
              onChange={(e) => handleFieldChange("Comments", e.target.value || null)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
              rows={3}
            />
          ) : (
            <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
              {formData.Comments || "—"}
            </div>
          )}
        </div>

        <div className="mt-4">
          <label className="block text-sm font-semibold text-slate-900 mb-1">Internal Comments</label>
          {isEditing ? (
            <textarea
              value={formData.Internal_Comments || ""}
              onChange={(e) => handleFieldChange("Internal_Comments", e.target.value || null)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
              rows={3}
            />
          ) : (
            <div className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm">
              {formData.Internal_Comments || "—"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
