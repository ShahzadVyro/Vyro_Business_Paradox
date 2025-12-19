"use client";

import { useState } from "react";
import Link from "next/link";
import type { OnboardingSubmission } from "@/types/onboarding";
import SubmissionDetail from "./submission-detail";
import { formatDate } from "@/lib/formatters";
import clsx from "clsx";

interface SubmissionsCardsProps {
  submissions: OnboardingSubmission[];
  onEdit?: (submissionId: string) => void;
}

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

export default function SubmissionsCards({ submissions, onEdit }: SubmissionsCardsProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  const toggleCard = (submissionId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(submissionId)) {
        next.delete(submissionId);
      } else {
        next.add(submissionId);
      }
      return next;
    });
  };

  if (submissions.length === 0) {
    return (
      <div className="mt-8 rounded-3xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
        No submissions match these filters.
      </div>
    );
  }

  return (
    <div className="mt-6 grid gap-3">
      {submissions.map((submission) => {
        const isExpanded = expandedCards.has(submission.Submission_ID);
        const submittedDate = submission.Created_At
          ? submission.Created_At.includes(" ")
            ? formatDate(submission.Created_At.split(" ")[0])
            : formatDate(submission.Created_At)
          : "—";

        return (
          <div key={submission.Submission_ID} className="space-y-0">
            <button
              type="button"
              onClick={() => toggleCard(submission.Submission_ID)}
              className={clsx(
                "flex w-full items-center justify-between rounded-3xl border px-4 py-3 text-left shadow-sm transition",
                isExpanded
                  ? "border-cyan-400 bg-cyan-50 shadow-lg"
                  : "border-slate-200 bg-white hover:border-cyan-300 hover:shadow-md",
              )}
            >
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{submission.Full_Name}</p>
                <p className="text-xs text-slate-500">{submission.Official_Email ?? "—"}</p>
                <p className="text-xs text-slate-400">Submitted {submittedDate}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span
                  className={clsx(
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                    getStatusBadgeClass(submission.Status)
                  )}
                >
                  {submission.Status}
                </span>
                <p className="text-xs text-slate-500">{submission.Department ?? "—"}</p>
              </div>
            </button>
            {isExpanded && (
              <div className="rounded-3xl border border-t-0 border-slate-200 bg-white px-4 py-4 shadow-sm">
                <div className="mb-4 flex items-center justify-end gap-2">
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
                      onClick={(e) => e.stopPropagation()}
                    >
                      Edit
                    </Link>
                  )}
                </div>
                <SubmissionDetail submission={submission} showHeader={false} showSlackLink={true} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
