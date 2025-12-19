"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNewHires, useLeavers, useIncrements, useConfirmations } from "@/hooks/use-pay-template";
import { useQueryClient } from "@tanstack/react-query";
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
  const [showUnapprovedOnly, setShowUnapprovedOnly] = useState(false);
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: newHires, isLoading: newHiresLoading } = useNewHires(month);
  const { data: leavers, isLoading: leaversLoading } = useLeavers(month);
  const { data: increments, isLoading: incrementsLoading } = useIncrements(month);
  const { data: confirmations, isLoading: confirmationsLoading } = useConfirmations(month);

  const isLoading = newHiresLoading || leaversLoading || incrementsLoading || confirmationsLoading;

  const handleApproveConfirmation = async (employeeId: string) => {
    if (!employeeId) return;
    
    setApprovingIds((prev) => new Set(prev).add(employeeId));
    try {
      const response = await fetch("/api/pay-template/confirmations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          month,
          approvedBy: "User", // TODO: Get from auth context
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to approve confirmation");
      }

      // Invalidate and refetch confirmations
      await queryClient.invalidateQueries({ queryKey: ["pay-template", "confirmations", month] });
    } catch (error) {
      console.error("Error approving confirmation:", error);
      alert(error instanceof Error ? error.message : "Failed to approve confirmation");
    } finally {
      setApprovingIds((prev) => {
        const next = new Set(prev);
        next.delete(employeeId);
        return next;
      });
    }
  };

  // Filter confirmations based on toggle
  const filteredConfirmations = showUnapprovedOnly
    ? confirmations?.filter((c: PayTemplateConfirmation) => !c.Approved) || []
    : confirmations || [];

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
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-600">
                    To add a new increment, go to the Employee Directory and edit the employee record.
                  </p>
                  <button
                    onClick={() => router.push("/directory")}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Go to Employee Directory
                  </button>
                </div>
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
              </div>
            )}

            {/* Confirmations Tab */}
            {activeTab === "confirmations" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={showUnapprovedOnly}
                      onChange={(e) => setShowUnapprovedOnly(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    <span>Show unapproved only</span>
                  </label>
                </div>
                <div className="overflow-x-auto">
                  {filteredConfirmations.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="px-3 py-2 text-left">Employee ID</th>
                          <th className="px-3 py-2 text-left">Employee Name</th>
                          <th className="px-3 py-2 text-left">Probation End Date</th>
                          <th className="px-3 py-2 text-left">Confirmation Date</th>
                          <th className="px-3 py-2 text-left">Currency</th>
                          <th className="px-3 py-2 text-left">Updated Salary</th>
                          <th className="px-3 py-2 text-left">Approved</th>
                          <th className="px-3 py-2 text-left">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredConfirmations.map((confirmation: PayTemplateConfirmation, idx: number) => (
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
                            <td className="px-3 py-2 text-slate-600">
                              {confirmation.Approved ? (
                                <span className="inline-flex items-center gap-1 text-green-600">
                                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  Approved
                                </span>
                              ) : (
                                <span className="text-slate-400">Pending</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {!confirmation.Approved && confirmation.Employee_ID && (
                                <button
                                  onClick={() => handleApproveConfirmation(confirmation.Employee_ID!)}
                                  disabled={approvingIds.has(confirmation.Employee_ID!)}
                                  className="rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                                >
                                  {approvingIds.has(confirmation.Employee_ID!) ? "Approving..." : "Approve"}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="p-6 text-center text-sm text-slate-400">
                      {showUnapprovedOnly 
                        ? `No unapproved confirmations found for ${month}.`
                        : `No confirmations found for ${month}.`}
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PayTemplateTabs;
