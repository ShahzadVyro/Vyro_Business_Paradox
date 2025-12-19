"use client";

import { useState } from "react";
import { useNewHires, useLeavers, useIncrements, useConfirmations } from "@/hooks/use-pay-template";
import { formatDate } from "@/lib/formatters";
import type { PayTemplateNewHire, PayTemplateLeaver, PayTemplateIncrement, PayTemplateConfirmation } from "@/types/payroll";

type TabType = "new-hires" | "leavers" | "increments" | "confirmations";

const PayTemplateTabs = () => {
  const [activeTab, setActiveTab] = useState<TabType>("new-hires");
  const [month, setMonth] = useState<string>(() => {
    // Default to current month
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data: newHires, isLoading: newHiresLoading } = useNewHires(month);
  const { data: leavers, isLoading: leaversLoading } = useLeavers(month);
  const { data: increments, isLoading: incrementsLoading } = useIncrements(month);
  const { data: confirmations, isLoading: confirmationsLoading } = useConfirmations(month);

  const isLoading = newHiresLoading || leaversLoading || incrementsLoading || confirmationsLoading;

  const tabs = [
    { id: "new-hires" as TabType, label: "New Hires" },
    { id: "leavers" as TabType, label: "Leavers" },
    { id: "increments" as TabType, label: "Increments" },
    { id: "confirmations" as TabType, label: "Confirmations" },
  ];

  const formatByCurrency = (value?: number | null, currency = "PKR") => {
    if (!value) return "—";
    return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-PK", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-4xl border border-slate-200 bg-white/70 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-semibold text-slate-900">Pay Template</h1>
            <p className="mt-2 text-sm text-slate-500">
              Manage new hires, leavers, increments, and confirmations for payroll processing.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-sm text-slate-500">
            <label className="text-xs uppercase tracking-wide text-slate-400">Payroll Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
              min="2020-01"
              max={`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-4xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="flex gap-2 border-b border-slate-200 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-semibold transition rounded-t-2xl ${
                activeTab === tab.id
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-sm text-slate-400">Loading {tabs.find((t) => t.id === activeTab)?.label}...</div>
        ) : (
          <>
            {/* New Hires Tab */}
            {activeTab === "new-hires" && (
              <div className="overflow-x-auto">
                {newHires && newHires.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">Month</th>
                        <th className="px-3 py-2 text-left">Employee ID</th>
                        <th className="px-3 py-2 text-left">Employee Name</th>
                        <th className="px-3 py-2 text-left">Designation</th>
                        <th className="px-3 py-2 text-left">Date of Joining</th>
                        <th className="px-3 py-2 text-left">Currency</th>
                        <th className="px-3 py-2 text-left">Salary</th>
                        <th className="px-3 py-2 text-left">Location</th>
                        <th className="px-3 py-2 text-left">Bank Name</th>
                        <th className="px-3 py-2 text-left">Comments by Aun</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newHires.map((hire: PayTemplateNewHire, idx: number) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="px-3 py-2 text-slate-600">{hire.Type || "New Hire"}</td>
                          <td className="px-3 py-2 text-slate-600">{hire.Month || month}</td>
                          <td className="px-3 py-2 text-slate-900">
                            {hire.Employee_ID || "—"}
                            {hire.Employee_ID_Lookup && <span className="text-xs text-blue-500 ml-1">(lookup)</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-900">{hire.Employee_Name}</td>
                          <td className="px-3 py-2 text-slate-600">{hire.Designation || "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{formatDate(hire.Date_of_Joining) || "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{hire.Currency}</td>
                          <td className="px-3 py-2 text-slate-900">{formatByCurrency(hire.Salary, hire.Currency)}</td>
                          <td className="px-3 py-2 text-slate-600">{hire.Employment_Location || "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{hire.Bank_Name || "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{hire.Comments_by_Aun || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="p-6 text-center text-sm text-slate-400">No new hires found for {month}.</p>
                )}
              </div>
            )}

            {/* Leavers Tab */}
            {activeTab === "leavers" && (
              <div className="overflow-x-auto">
                {leavers && leavers.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">Month</th>
                        <th className="px-3 py-2 text-left">Employee ID</th>
                        <th className="px-3 py-2 text-left">Employee Name</th>
                        <th className="px-3 py-2 text-left">Employment End Date</th>
                        <th className="px-3 py-2 text-left">Payroll Type</th>
                        <th className="px-3 py-2 text-left">Comments</th>
                        <th className="px-3 py-2 text-left">Devices Returned</th>
                        <th className="px-3 py-2 text-left">Comments by Aun</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leavers.map((leaver: PayTemplateLeaver, idx: number) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="px-3 py-2 text-slate-600">{leaver.Type || "Leaver"}</td>
                          <td className="px-3 py-2 text-slate-600">{leaver.Month || month}</td>
                          <td className="px-3 py-2 text-slate-900">
                            {leaver.Employee_ID || "—"}
                            {leaver.Employee_ID_Lookup && <span className="text-xs text-blue-500 ml-1">(lookup)</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-900">{leaver.Employee_Name}</td>
                          <td className="px-3 py-2 text-slate-600">{formatDate(leaver.Employment_End_Date) || "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{leaver.Payroll_Type}</td>
                          <td className="px-3 py-2 text-slate-600">{leaver.Comments || "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{leaver.Devices_Returned || "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{leaver.Comments_by_Aun || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="p-6 text-center text-sm text-slate-400">No leavers found for {month}.</p>
                )}
              </div>
            )}

            {/* Increments Tab */}
            {activeTab === "increments" && (
              <div className="overflow-x-auto">
                {increments && increments.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-3 py-2 text-left">Type</th>
                        <th className="px-3 py-2 text-left">Month</th>
                        <th className="px-3 py-2 text-left">Employee ID</th>
                        <th className="px-3 py-2 text-left">Employee Name</th>
                        <th className="px-3 py-2 text-left">Currency</th>
                        <th className="px-3 py-2 text-left">Previous Salary</th>
                        <th className="px-3 py-2 text-left">Updated Salary</th>
                        <th className="px-3 py-2 text-left">Effective Date</th>
                        <th className="px-3 py-2 text-left">Comments</th>
                        <th className="px-3 py-2 text-left">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {increments.map((increment: PayTemplateIncrement, idx: number) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="px-3 py-2 text-slate-600">{increment.Type || "Increment"}</td>
                          <td className="px-3 py-2 text-slate-600">{increment.Month || month}</td>
                          <td className="px-3 py-2 text-slate-900">
                            {increment.Employee_ID || "—"}
                            {increment.Employee_ID_Lookup && <span className="text-xs text-blue-500 ml-1">(lookup)</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-900">{increment.Employee_Name}</td>
                          <td className="px-3 py-2 text-slate-600">{increment.Currency}</td>
                          <td className="px-3 py-2 text-slate-600">
                            {increment.Previous_Salary != null ? formatByCurrency(increment.Previous_Salary, increment.Currency) : "—"}
                            {increment.Previous_Salary_Lookup && <span className="text-xs text-blue-500 ml-1">(lookup)</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-900">{formatByCurrency(increment.Updated_Salary, increment.Currency)}</td>
                          <td className="px-3 py-2 text-slate-600">{formatDate(increment.Effective_Date) || "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{increment.Comments || "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{increment.Remarks || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="p-6 text-center text-sm text-slate-400">No increments found for {month}.</p>
                )}
              </div>
            )}

            {/* Confirmations Tab */}
            {activeTab === "confirmations" && (
              <div className="overflow-x-auto">
                {confirmations && confirmations.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="px-3 py-2 text-left">Employee ID</th>
                        <th className="px-3 py-2 text-left">Employee Name</th>
                        <th className="px-3 py-2 text-left">Probation End Date</th>
                        <th className="px-3 py-2 text-left">Confirmation Date</th>
                        <th className="px-3 py-2 text-left">Currency</th>
                        <th className="px-3 py-2 text-left">Updated Salary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {confirmations.map((confirmation: PayTemplateConfirmation, idx: number) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="px-3 py-2 text-slate-900">
                            {confirmation.Employee_ID || "—"}
                            {confirmation.Employee_ID_Lookup && <span className="text-xs text-blue-500 ml-1">(lookup)</span>}
                          </td>
                          <td className="px-3 py-2 text-slate-900">{confirmation.Employee_Name}</td>
                          <td className="px-3 py-2 text-slate-600">{formatDate(confirmation.Probation_End_Date) || "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{formatDate(confirmation.Confirmation_Date) || "—"}</td>
                          <td className="px-3 py-2 text-slate-600">{confirmation.Currency || "—"}</td>
                          <td className="px-3 py-2 text-slate-900">
                            {confirmation.Updated_Salary != null ? formatByCurrency(confirmation.Updated_Salary, confirmation.Currency || "PKR") : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="p-6 text-center text-sm text-slate-400">No confirmations found for {month}.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PayTemplateTabs;
