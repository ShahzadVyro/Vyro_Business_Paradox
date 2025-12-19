"use client";

import { useState } from "react";
import type { EmployeeRecord } from "@/types/employee";

interface EditFormProps {
  employee: EmployeeRecord;
  onSave: (field: string, value: string | number | null, reason?: string) => Promise<void>;
  onCancel: () => void;
}

export const PersonalDetailsForm = ({ employee, onSave, onCancel }: EditFormProps) => {
  const [formData, setFormData] = useState({
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
