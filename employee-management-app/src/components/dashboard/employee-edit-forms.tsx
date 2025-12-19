"use client";

import { useState, useEffect } from "react";
import type { EmployeeRecord } from "@/types/employee";

interface EditFormProps {
  employee: EmployeeRecord;
  onSave: (field: string, value: string | number | null, reason?: string) => Promise<void>;
  onCancel: () => void;
}

export const PersonalDetailsForm = ({ employee, onSave, onCancel }: EditFormProps) => {
  const [formData, setFormData] = useState({
    Full_Name: employee.Full_Name ?? "",
    Official_Email: employee.Official_Email ?? "",
    Personal_Email: employee.Personal_Email ?? "",
    Contact_Number: employee.Contact_Number ?? "",
    Date_of_Birth: employee.Date_of_Birth ?? "",
    Job_Location: employee.Job_Location ?? "",
  });
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      for (const [field, value] of Object.entries(formData)) {
        const currentValue = employee[field as keyof EmployeeRecord];
        if (String(value) !== String(currentValue ?? "")) {
          await onSave(field, value || null, reason || undefined);
        }
      }
      onCancel();
    } catch (error) {
      console.error("Error saving personal details:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Full Name <span className="text-red-500">*</span></label>
        <input
          type="text"
          value={formData.Full_Name}
          onChange={(e) => setFormData({ ...formData, Full_Name: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
          required
          minLength={2}
          maxLength={100}
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Official Email</label>
        <input
          type="email"
          value={formData.Official_Email}
          onChange={(e) => setFormData({ ...formData, Official_Email: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Personal Email</label>
        <input
          type="email"
          value={formData.Personal_Email}
          onChange={(e) => setFormData({ ...formData, Personal_Email: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Contact Number</label>
        <input
          type="tel"
          value={formData.Contact_Number}
          onChange={(e) => setFormData({ ...formData, Contact_Number: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Date of Birth</label>
        <input
          type="date"
          value={formData.Date_of_Birth}
          onChange={(e) => setFormData({ ...formData, Date_of_Birth: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Job Location</label>
        <input
          type="text"
          value={formData.Job_Location}
          onChange={(e) => setFormData({ ...formData, Job_Location: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Reason for Change (Optional)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
          rows={2}
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export const EmploymentDetailsForm = ({ employee, onSave, onCancel }: EditFormProps) => {
  const [formData, setFormData] = useState({
    Department: employee.Department ?? "",
    Designation: employee.Designation ?? "",
    Reporting_Manager: employee.Reporting_Manager ?? "",
    Employment_End_Date: employee.Employment_End_Date ?? "",
  });
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      for (const [field, value] of Object.entries(formData)) {
        const currentValue = employee[field as keyof EmployeeRecord];
        if (String(value) !== String(currentValue ?? "")) {
          await onSave(field, value || null, reason || undefined);
        }
      }
      onCancel();
    } catch (error) {
      console.error("Error saving employment details:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Department</label>
        <input
          type="text"
          value={formData.Department}
          onChange={(e) => setFormData({ ...formData, Department: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Designation</label>
        <input
          type="text"
          value={formData.Designation}
          onChange={(e) => setFormData({ ...formData, Designation: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Reporting Manager</label>
        <input
          type="text"
          value={formData.Reporting_Manager}
          onChange={(e) => setFormData({ ...formData, Reporting_Manager: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Employment End Date</label>
        <input
          type="date"
          value={formData.Employment_End_Date}
          onChange={(e) => setFormData({ ...formData, Employment_End_Date: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-slate-500">Leave empty if employee is still active</p>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Reason for Change (Optional)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
          rows={2}
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export const AccountDetailsForm = ({ employee, onSave, onCancel }: EditFormProps) => {
  const [formData, setFormData] = useState({
    Bank_Name: (employee as any).Bank_Name ?? "",
    Bank_Account_Title: (employee as any).Bank_Account_Title ?? "",
    Bank_Account_Number_IBAN: (employee as any).Bank_Account_Number_IBAN ?? (employee as any).Bank_Account_IBAN ?? "",
    Swift_Code_BIC: (employee as any).Swift_Code_BIC ?? "",
    Routing_Number: (employee as any).Routing_Number ?? "",
  });
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      for (const [field, value] of Object.entries(formData)) {
        const currentValue = (employee as any)[field];
        if (String(value) !== String(currentValue ?? "")) {
          // Map Bank_Account_Number_IBAN to Account_Number_IBAN if needed
          const fieldName = field === 'Bank_Account_Number_IBAN' ? 'Account_Number_IBAN' : field;
          await onSave(fieldName, value || null, reason || undefined);
        }
      }
      onCancel();
    } catch (error) {
      console.error("Error saving account details:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Bank Name</label>
        <input
          type="text"
          value={formData.Bank_Name}
          onChange={(e) => setFormData({ ...formData, Bank_Name: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Account Title</label>
        <input
          type="text"
          value={formData.Bank_Account_Title}
          onChange={(e) => setFormData({ ...formData, Bank_Account_Title: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Account Number / IBAN</label>
        <input
          type="text"
          value={formData.Bank_Account_Number_IBAN}
          onChange={(e) => setFormData({ ...formData, Bank_Account_Number_IBAN: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Swift Code / BIC</label>
        <input
          type="text"
          value={formData.Swift_Code_BIC}
          onChange={(e) => setFormData({ ...formData, Swift_Code_BIC: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Routing Number</label>
        <input
          type="text"
          value={formData.Routing_Number}
          onChange={(e) => setFormData({ ...formData, Routing_Number: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Reason for Change (Optional)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
          rows={2}
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export const EOBIDetailsForm = ({ employee, onSave, onCancel }: EditFormProps) => {
  const [formData, setFormData] = useState({
    EOBI_Number: (employee as any).EOBI_Number ?? "",
    EMP_AREA_CODE: (employee as any).EMP_AREA_CODE ?? "FAA",
    EMP_REG_SERIAL_NO: (employee as any).EMP_REG_SERIAL_NO ?? "4320",
    EMP_SUB_AREA_CODE: (employee as any).EMP_SUB_AREA_CODE ?? " ",
    EMP_SUB_SERIAL_NO: (employee as any).EMP_SUB_SERIAL_NO ?? "0",
  });
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      for (const [field, value] of Object.entries(formData)) {
        const currentValue = (employee as any)[field];
        if (String(value) !== String(currentValue ?? "")) {
          await onSave(field, value || null, reason || undefined);
        }
      }
      onCancel();
    } catch (error) {
      console.error("Error saving EOBI details:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">EOBI Number *</label>
        <input
          type="text"
          value={formData.EOBI_Number}
          onChange={(e) => setFormData({ ...formData, EOBI_Number: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
          placeholder="e.g., 4700G690432"
          required
        />
        <p className="mt-1 text-xs text-slate-500">Format: Usually starts with 4700 followed by letters and numbers</p>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">EMP Area Code</label>
        <input
          type="text"
          value={formData.EMP_AREA_CODE}
          onChange={(e) => setFormData({ ...formData, EMP_AREA_CODE: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
          placeholder="FAA"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">EMP Reg Serial No</label>
        <input
          type="text"
          value={formData.EMP_REG_SERIAL_NO}
          onChange={(e) => setFormData({ ...formData, EMP_REG_SERIAL_NO: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
          placeholder="4320"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">EMP Sub Area Code</label>
        <input
          type="text"
          value={formData.EMP_SUB_AREA_CODE}
          onChange={(e) => setFormData({ ...formData, EMP_SUB_AREA_CODE: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
          placeholder=" "
        />
        <p className="mt-1 text-xs text-slate-500">Usually a single space</p>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">EMP Sub Serial No</label>
        <input
          type="text"
          value={formData.EMP_SUB_SERIAL_NO}
          onChange={(e) => setFormData({ ...formData, EMP_SUB_SERIAL_NO: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
          placeholder="0"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Reason for Change (Optional)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
          rows={2}
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export const IncrementForm = ({ employee, onSave, onCancel }: EditFormProps) => {
  const [formData, setFormData] = useState({
    Effective_Date: "",
    Updated_Salary: "",
    Currency: "PKR",
    Previous_Salary: "",
    Designation: employee.Designation ?? "",
    Department: employee.Department ?? "",
    Comments: "",
    Remarks: "",
  });
  const [loading, setLoading] = useState(false);
  const [fetchingPreviousSalary, setFetchingPreviousSalary] = useState(false);

  // Fetch previous salary and currency when component mounts or currency changes
  useEffect(() => {
    const fetchPreviousSalary = async () => {
      if (!employee.Employee_ID) return;
      
      setFetchingPreviousSalary(true);
      try {
        const response = await fetch(
          `/api/pay-template/increments?employeeId=${employee.Employee_ID}&currency=${formData.Currency}`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.previousSalary != null) {
            setFormData((prev) => ({
              ...prev,
              Previous_Salary: String(data.previousSalary),
            }));
          }
          if (data.currency) {
            setFormData((prev) => ({
              ...prev,
              Currency: data.currency,
            }));
          }
        }
      } catch (error) {
        console.error("Error fetching previous salary:", error);
      } finally {
        setFetchingPreviousSalary(false);
      }
    };

    fetchPreviousSalary();
  }, [employee.Employee_ID, formData.Currency]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`/api/pay-template/increments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: String(employee.Employee_ID),
          effectiveDate: formData.Effective_Date,
          updatedSalary: Number(formData.Updated_Salary),
          currency: formData.Currency,
          previousSalary: formData.Previous_Salary ? Number(formData.Previous_Salary) : null,
          designation: formData.Designation || null,
          department: formData.Department || null,
          comments: formData.Comments || null,
          remarks: formData.Remarks || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to save increment");
      }

      // Update employee record with new salary, designation, and department
      const updates: Array<{ field: string; value: string | number | null }> = [
        { field: "Gross_Salary", value: Number(formData.Updated_Salary) },
      ];

      if (formData.Designation) {
        updates.push({ field: "Designation", value: formData.Designation });
      }

      if (formData.Department) {
        updates.push({ field: "Department", value: formData.Department });
      }

      // Save updates to employee
      for (const update of updates) {
        await onSave(update.field, update.value, `Increment effective ${formData.Effective_Date}`);
      }

      onCancel();
    } catch (error) {
      console.error("Error saving increment:", error);
      alert(error instanceof Error ? error.message : "Failed to save increment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">
          Effective Date <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          value={formData.Effective_Date}
          onChange={(e) => setFormData({ ...formData, Effective_Date: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">
          Currency <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.Currency}
          onChange={(e) => setFormData({ ...formData, Currency: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
          required
        >
          <option value="PKR">PKR</option>
          <option value="USD">USD</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">
          Previous Salary
        </label>
        <input
          type="number"
          value={formData.Previous_Salary}
          readOnly
          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm"
          placeholder={fetchingPreviousSalary ? "Loading..." : "Auto-filled from latest salary"}
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">
          Updated Salary <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          value={formData.Updated_Salary}
          onChange={(e) => setFormData({ ...formData, Updated_Salary: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
          required
          min="0"
          step="0.01"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Designation (Optional)</label>
        <input
          type="text"
          value={formData.Designation}
          onChange={(e) => setFormData({ ...formData, Designation: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
          placeholder="Keep same or change"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Department (Optional)</label>
        <input
          type="text"
          value={formData.Department}
          onChange={(e) => setFormData({ ...formData, Department: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
          placeholder="Keep same or change"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Comments (Optional)</label>
        <textarea
          value={formData.Comments}
          onChange={(e) => setFormData({ ...formData, Comments: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
          rows={2}
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-900 mb-1">Remarks (Optional)</label>
        <textarea
          value={formData.Remarks}
          onChange={(e) => setFormData({ ...formData, Remarks: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm"
          rows={2}
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={loading || fetchingPreviousSalary}
          className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save Increment"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};
