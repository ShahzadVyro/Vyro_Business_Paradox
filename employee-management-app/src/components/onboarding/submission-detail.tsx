"use client";

import { useState } from "react";
import Link from "next/link";
import DocumentViewer from "@/components/ui/document-viewer";
import { getDrivePreviewUrl, getDriveDownloadUrl, extractDriveFileId } from "@/lib/drive-urls";
import type { OnboardingSubmission } from "@/types/onboarding";

const DOCUMENT_URL_KEYS = new Set([
  "Degree_Transcript_URL",
  "Last_Salary_Slip_URL",
  "Experience_Letter_URL",
  "Resume_URL",
  "Passport_Photo_URL",
  "CNIC_Front_URL",
  "CNIC_Back_URL",
]);

const sections: Array<{ title: string; fields: Array<{ key: string; label: string }> }> = [
  {
    title: "Personal Information",
    fields: [
      { key: "Full_Name", label: "Full Name" },
      { key: "CNIC_ID", label: "CNIC / ID" },
      { key: "Personal_Email", label: "Personal Email" },
      { key: "Official_Email", label: "Official Email" },
      { key: "Contact_Number", label: "Contact Number" },
      { key: "Date_of_Birth", label: "Date of Birth" },
      { key: "Gender", label: "Gender" },
      { key: "Current_Address", label: "Current Address" },
      { key: "Permanent_Address", label: "Permanent Address" },
      { key: "Nationality", label: "Nationality" },
      { key: "LinkedIn_URL", label: "LinkedIn" },
      { key: "Marital_Status", label: "Marital Status" },
      { key: "Age", label: "Age" },
      { key: "Number_of_Children", label: "Number of Children" },
      { key: "Spouse_Name", label: "Spouse Name" },
      { key: "Spouse_DOB", label: "Spouse Date of Birth" },
    ],
  },
  {
    title: "Employment",
    fields: [
      { key: "Joining_Date", label: "Joining Date" },
      { key: "Department", label: "Department" },
      { key: "Designation", label: "Designation" },
      { key: "Reporting_Manager", label: "Reporting Manager" },
      { key: "Job_Type", label: "Job Type" },
      { key: "Job_Location", label: "Job Location" },
      { key: "Recruiter_Name", label: "Recruiter" },
      { key: "Preferred_Device", label: "Preferred Device" },
      { key: "Employment_Location", label: "Employment Location" },
    ],
  },
  {
    title: "Emergency Contact",
    fields: [
      { key: "Father_Name", label: "Father's Name" },
      { key: "Emergency_Contact_Number", label: "Emergency Contact Number" },
      { key: "Emergency_Contact_Relationship", label: "Relationship" },
      { key: "Blood_Group", label: "Blood Group" },
    ],
  },
  {
    title: "Documents",
    fields: [
      { key: "Degree_Transcript_URL", label: "Degree / Transcript URL" },
      { key: "Last_Salary_Slip_URL", label: "Last Salary Slip URL" },
      { key: "Experience_Letter_URL", label: "Experience Letter URL" },
      { key: "Resume_URL", label: "Resume URL" },
    ],
  },
  {
    title: "Bank",
    fields: [
      { key: "Bank_Name", label: "Bank Name" },
      { key: "Bank_Account_Title", label: "Account Title" },
      { key: "Bank_Account_Number_IBAN", label: "IBAN" },
      { key: "Swift_Code_BIC", label: "Swift / BIC" },
      { key: "National_Tax_Number", label: "NTN" },
    ],
  },
  {
    title: "NSTP Card",
    fields: [
      { key: "Passport_Photo_URL", label: "Passport Photo" },
      { key: "CNIC_Front_URL", label: "CNIC Front" },
      { key: "CNIC_Back_URL", label: "CNIC Back" },
      { key: "Vehicle_Number", label: "Vehicle Number" },
    ],
  },
  {
    title: "First Day at Vyro",
    fields: [
      { key: "Introduction", label: "Introduction" },
      { key: "Fun_Fact", label: "Fun Fact" },
      { key: "Shirt_Size", label: "Shirt Size" },
    ],
  },
];

function formatValue(
  value: unknown,
  fieldKey: string,
  fieldLabel: string,
  onOpenDocument: (title: string, previewUrl: string, downloadUrl: string) => void
) {
  if (!value || value === null || value === "") return "—";
  if (typeof value === "string" && DOCUMENT_URL_KEYS.has(fieldKey) && extractDriveFileId(value)) {
    const previewUrl = getDrivePreviewUrl(value);
    const downloadUrl = getDriveDownloadUrl(value);
    if (previewUrl && downloadUrl) {
      return (
        <span className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenDocument(fieldLabel, previewUrl, downloadUrl)}
            className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            View
          </button>
          <a
            href={downloadUrl}
            download
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Download
          </a>
        </span>
      );
    }
  }
  if (typeof value === "string" && value.startsWith("http")) {
    return (
      <a href={value} target="_blank" rel="noreferrer" className="text-slate-900 underline hover:text-slate-700">
        View Link
      </a>
    );
  }
  return String(value);
}

interface SubmissionDetailProps {
  submission: OnboardingSubmission;
  showHeader?: boolean;
  showSlackLink?: boolean;
}

export default function SubmissionDetail({ submission, showHeader = false, showSlackLink = true }: SubmissionDetailProps) {
  const [viewer, setViewer] = useState<{
    title: string;
    previewUrl: string;
    downloadUrl: string;
  } | null>(null);

  const openDocument = (title: string, previewUrl: string, downloadUrl: string) => {
    setViewer({ title, previewUrl, downloadUrl });
  };

  return (
    <div className="space-y-4">
      {showHeader && (
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Submission ID · {submission.Submission_ID}</p>
            <h2 className="text-2xl font-semibold text-slate-900">{submission.Full_Name}</h2>
            <p className="text-sm text-slate-500">
              {submission.Designation ?? "—"} • {submission.Department ?? "—"}
            </p>
          </div>
          <div className="text-right text-sm text-slate-500">
            <div
              className={`mb-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                submission.Status === "confirmed"
                  ? "bg-emerald-50 text-emerald-700"
                  : submission.Status === "cancelled"
                    ? "bg-rose-50 text-rose-700"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {submission.Status}
            </div>
            <p>Submitted · {submission.Created_At}</p>
            {showSlackLink && submission.Slack_TS && submission.Slack_Channel && (
              <Link
                href={`https://slack.com/app_redirect?channel=${submission.Slack_Channel}&thread_ts=${submission.Slack_TS}`}
                className="text-xs font-semibold text-slate-900 underline"
                target="_blank"
                rel="noreferrer"
              >
                Open Slack Thread
              </Link>
            )}
          </div>
        </div>
      )}
      <div className="grid gap-5">
        {sections.map((section) => (
          <section key={section.title} className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{section.title}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {section.fields.map((field) => {
                const value = (submission as unknown as Record<string, unknown>)[field.key];
                return (
                  <div key={field.key} className="text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{field.label}</p>
                    <p className="font-medium text-slate-900">
                      {formatValue(value, field.key, field.label, openDocument)}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <DocumentViewer
        open={!!viewer}
        onClose={() => setViewer(null)}
        previewUrl={viewer?.previewUrl ?? null}
        downloadUrl={viewer?.downloadUrl ?? null}
        title={viewer?.title ?? ""}
      />
    </div>
  );
}

