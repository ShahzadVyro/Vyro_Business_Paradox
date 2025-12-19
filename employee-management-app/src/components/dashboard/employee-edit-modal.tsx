"use client";

import { useState } from "react";
import { PersonalDetailsForm, EmploymentDetailsForm, AccountDetailsForm, EOBIDetailsForm, IncrementForm } from "./employee-edit-forms";
import type { EmployeeRecord } from "@/types/employee";

interface Props {
  employee: EmployeeRecord;
  isOpen: boolean;
  onClose: () => void;
  onSave: (field: string, value: string | number | null, reason?: string) => Promise<void>;
}

type TabType = "personal" | "employment" | "account" | "salary" | "eobi" | "increment";

const TABS: { id: TabType; label: string }[] = [
  { id: "personal", label: "Personal Details" },
  { id: "employment", label: "Employment" },
  { id: "account", label: "Account" },
  { id: "salary", label: "Salary" },
  { id: "eobi", label: "EOBI" },
  { id: "increment", label: "Increment" },
];

export default function EmployeeEditModal({ employee, isOpen, onClose, onSave }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("personal");

  if (!isOpen) return null;

  const handleSave = async (field: string, value: string | number | null, reason?: string) => {
    await onSave(field, value, reason);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-4xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Edit Employee</h2>
            <p className="text-sm text-slate-500">{employee.Full_Name}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 px-6 pt-4 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap rounded-t-2xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "bg-slate-900 text-white"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-180px)] p-6">
          {activeTab === "personal" && (
            <PersonalDetailsForm employee={employee} onSave={handleSave} onCancel={onClose} />
          )}
          {activeTab === "employment" && (
            <EmploymentDetailsForm employee={employee} onSave={handleSave} onCancel={onClose} />
          )}
          {activeTab === "account" && (
            <AccountDetailsForm employee={employee} onSave={handleSave} onCancel={onClose} />
          )}
          {activeTab === "salary" && (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-400">
              Salary details are managed through payroll system
            </div>
          )}
          {activeTab === "eobi" && (
            <EOBIDetailsForm employee={employee} onSave={handleSave} onCancel={onClose} />
          )}
          {activeTab === "increment" && (
            <IncrementForm employee={employee} onSave={handleSave} onCancel={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}


