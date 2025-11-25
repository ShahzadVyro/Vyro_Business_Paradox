import Link from "next/link";
import { listOnboardingSubmissions } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

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

const formatValue = (value: unknown) => {
  if (!value) return "—";
  if (typeof value === "string" && value.startsWith("http")) {
    return (
      <a href={value} target="_blank" rel="noreferrer" className="text-slate-900 underline">
        Link
      </a>
    );
  }
  return String(value);
};

export default async function SubmissionsPage() {
  const submissions = await listOnboardingSubmissions();

  return (
    <div className="space-y-6">
      <header className="rounded-4xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Vyro • People Operations</p>
        <h1 className="text-3xl font-semibold text-slate-900">Onboarding Submissions</h1>
        <p className="text-sm text-slate-500">Full detail view for each employee intake.</p>
      </header>
      {submissions.length === 0 ? (
        <div className="rounded-4xl border border-dashed border-slate-200 bg-white/80 p-12 text-center text-slate-500 shadow-sm">
          No submissions yet.
        </div>
      ) : (
        <div className="space-y-6">
          {submissions.map((entry) => (
            <article key={entry.Submission_ID} className="rounded-4xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-200/60">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Submission ID · {entry.Submission_ID}</p>
                  <h2 className="text-2xl font-semibold text-slate-900">{entry.Full_Name}</h2>
                  <p className="text-sm text-slate-500">{entry.Designation ?? "—"} • {entry.Department ?? "—"}</p>
                </div>
                <div className="text-right text-sm text-slate-500">
                  <div
                    className={`mb-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                      entry.Status === "confirmed"
                        ? "bg-emerald-50 text-emerald-700"
                        : entry.Status === "cancelled"
                          ? "bg-rose-50 text-rose-700"
                          : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {entry.Status}
                  </div>
                  <p>Submitted · {entry.Created_At}</p>
                  {entry.Slack_TS && entry.Slack_Channel ? (
                    <Link
                      href={`https://slack.com/app_redirect?channel=${entry.Slack_Channel}&thread_ts=${entry.Slack_TS}`}
                      className="text-xs font-semibold text-slate-900 underline"
                    >
                      Open Slack Thread
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-400">Slack not sent yet</span>
                  )}
                </div>
              </div>
              <div className="mt-6 grid gap-5">
                {sections.map((section) => (
                  <section key={section.title} className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{section.title}</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {section.fields.map((field) => (
                        <div key={field.key} className="text-sm">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{field.label}</p>
                          <p className="font-medium text-slate-900">{formatValue((entry as unknown as Record<string, unknown>)[field.key])}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="text-right">
        <Link href="/onboarding" className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          Open form
        </Link>
      </div>
    </div>
  );
}

