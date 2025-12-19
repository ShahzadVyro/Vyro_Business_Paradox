"use client";

import { useState } from "react";
import Link from "next/link";
import type { OnboardingSubmission } from "@/types/onboarding";
import SubmissionDetail from "./submission-detail";
import { formatDate } from "@/lib/formatters";
import clsx from "clsx";

interface SubmissionsTableProps {
  submissions: OnboardingSubmission[];
  onEdit?: (submissionId: string) => void;
}

export default function SubmissionsTable({ submissions, onEdit }: SubmissionsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = (submissionId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(submissionId)) {
        next.delete(submissionId);
      } else {
        next.add(submissionId);
      }
      return next;
    });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-emerald-50 text-emerald-700";
      case "cancelled":
        return "bg-rose-50 text-rose-700";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  if (submissions.length === 0) {
    return (
      <div className="rounded-4xl border border-dashed border-slate-200 bg-white/80 p-12 text-center text-slate-500 shadow-sm">
        No submissions yet.
      </div>
    );
  }

  return (
    <div className="rounded-4xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/60 ring-1 ring-slate-100 overflow-hidden">
      {/* Table Header */}
      <div className="hidden md:grid md:grid-cols-[auto_1fr_120px_140px_140px_140px] gap-4 px-6 py-4 bg-slate-50 border-b border-slate-200">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400"></div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Name</div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Submitted</div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Department</div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</div>
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-slate-100">
        {submissions.map((submission) => {
          const isExpanded = expandedRows.has(submission.Submission_ID);
          return (
            <div key={submission.Submission_ID} className="transition-colors hover:bg-slate-50/50">
              {/* Main Row */}
              <div
                className={clsx(
                  "grid md:grid-cols-[auto_1fr_120px_140px_140px_140px] gap-4 px-6 py-4 items-center cursor-pointer",
                  isExpanded && "bg-slate-50/50"
                )}
                onClick={() => toggleRow(submission.Submission_ID)}
              >
                {/* Expand Icon */}
                <div className="flex items-center justify-center w-6 h-6">
                  <span className="text-slate-400 font-semibold">
                    {isExpanded ? "▼" : "▶"}
                  </span>
                </div>

                {/* Name */}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{submission.Full_Name}</p>
                  <p className="text-xs text-slate-500 truncate">{submission.Official_Email ?? "—"}</p>
                </div>

                {/* Status */}
                <div>
                  <span
                    className={clsx(
                      "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                      getStatusBadgeClass(submission.Status)
                    )}
                  >
                    {submission.Status}
                  </span>
                </div>

                {/* Submitted Date */}
                <div className="text-sm text-slate-600">
                  {submission.Created_At
                    ? submission.Created_At.includes(" ")
                      ? formatDate(submission.Created_At.split(" ")[0])
                      : formatDate(submission.Created_At)
                    : "—"}
                </div>

                {/* Department */}
                <div className="text-sm text-slate-600 truncate">{submission.Department ?? "—"}</div>

                {/* Actions */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {onEdit ? (
                    <button
                      onClick={() => onEdit(submission.Submission_ID)}
                      className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                    >
                      Edit
                    </button>
                  ) : (
                    <Link
                      href={`/submissions/edit/${submission.Submission_ID}`}
                      className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
                    >
                      Edit
                    </Link>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-6 pb-6 pt-2 border-t border-slate-100 bg-white">
                  <SubmissionDetail submission={submission} showHeader={false} showSlackLink={true} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
