"use client";

import { useMemo, useState } from "react";

interface FieldConfig {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "date" | "textarea" | "select";
  placeholder?: string;
  options?: string[];
  helper?: string;
  required?: boolean;
}

const personalFields: FieldConfig[] = [
  { name: "Full_Name", label: "Full Name", placeholder: "As per CNIC", required: true },
  { name: "CNIC_ID", label: "CNIC / ID", placeholder: "XXXXX-XXXXXXX-X", required: true },
  { name: "Personal_Email", label: "Personal Email", type: "email", required: true },
  { name: "Official_Email", label: "Official Email", type: "email", required: true },
  { name: "Contact_Number", label: "Contact Number", placeholder: "03XXXXXXXXX", required: true },
  { name: "Date_of_Birth", label: "Date of Birth", type: "date", required: true },
  { name: "Gender", label: "Gender", type: "select", options: ["Male", "Female", "Prefer not to say"], required: true },
  { name: "Current_Address", label: "Current Address", type: "textarea", required: true },
  { name: "Permanent_Address", label: "Permanent Address", type: "textarea", required: true },
  { name: "Nationality", label: "Nationality", required: true },
  { name: "LinkedIn_URL", label: "LinkedIn URL" },
  { name: "Marital_Status", label: "Marital Status", type: "select", options: ["Single", "Married"], required: true },
];

const employmentFields: FieldConfig[] = [
  { name: "Joining_Date", label: "Joining Date", type: "date", required: true },
  {
    name: "Department",
    label: "Department",
    type: "select",
    options: [
      "Business & Growth",
      "Mobile",
      "Backend",
      "Branding",
      "Admin",
      "Product Design",
      "Quality Assurance",
      "Social Media/ Youtube",
      "Social Media & Community Growth",
      "Machine Learning",
      "Frontend",
      "Marketing",
      "Product",
      "People & Talent",
      "SEO",
      "Finance",
      "Business Solutions",
      "Customer Success",
      "Web Engineering",
      "Devops",
      "Web GL",
      "Operations & Process Excellence",
    ],
    required: true,
  },
  { name: "Designation", label: "Designation", required: true },
  { name: "Reporting_Manager", label: "Reporting Manager", required: true },
  { name: "Job_Type", label: "Job Type", type: "select", options: ["Full Time", "Part Time", "Internship", "Consultant"], required: true },
  { name: "Job_Location", label: "Job Location", type: "select", options: ["OnSite", "Remote", "Hybrid"], required: true },
  {
    name: "Recruiter_Name",
    label: "Recruiter Name",
    type: "select",
    options: ["Annum Tirmizi", "Mustafa Shakil", "Mahreen Jafri"],
    required: true,
  },
  { name: "Preferred_Device", label: "Preferred Device", type: "select", options: ["MacBook", "Windows"], required: true },
];

const emergencyFields: FieldConfig[] = [
  { name: "Father_Name", label: "Father's Name", required: true },
  { name: "Emergency_Contact_Number", label: "Emergency Contact Number", placeholder: "03XXXXXXXXX", required: true },
  {
    name: "Emergency_Contact_Relationship",
    label: "Emergency Contact's Relationship",
    required: true,
  },
  {
    name: "Blood_Group",
    label: "Blood Group",
    type: "select",
    options: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"],
    required: true,
  },
];

const documentsFields: FieldConfig[] = [
  { name: "Degree_Transcript_URL", label: "Degree / Latest Transcript URL", helper: "Share drive link" },
  { name: "Last_Salary_Slip_URL", label: "Last Salary Slip URL" },
  { name: "Experience_Letter_URL", label: "Previous Company Experience Letter URL" },
  { name: "Resume_URL", label: "Resume / CV URL", required: true },
];

const bankFields: FieldConfig[] = [
  { name: "Bank_Name", label: "Bank Name", required: true },
  { name: "Bank_Account_Title", label: "Bank Account Title", required: true },
  { name: "National_Tax_Number", label: "National Tax Number (NTN)" },
  { name: "Swift_Code_BIC", label: "Swift Code / BIC Code", required: true },
  { name: "Bank_Account_Number_IBAN", label: "Bank Account Number - IBAN", required: true },
];

const nstpFields: FieldConfig[] = [
  { name: "Passport_Photo_URL", label: "Passport Size Picture URL", helper: "Upload to Drive and paste link" },
  { name: "CNIC_Front_URL", label: "CNIC Front URL" },
  { name: "CNIC_Back_URL", label: "CNIC Back URL" },
  { name: "Vehicle_Number", label: "Vehicle Number" },
];

const swagFields: FieldConfig[] = [
  { name: "Introduction", label: "Introduction (2-3 lines)", type: "textarea", required: true },
  { name: "Fun_Fact", label: "Fun Fact", type: "textarea", required: true },
  { name: "Shirt_Size", label: "Shirt Size", type: "select", options: ["S", "M", "L", "XL"], required: true },
];

const steps = [
  { title: "Personal Information", fields: personalFields },
  { title: "Employment Details", fields: employmentFields },
  { title: "Emergency Contact", fields: emergencyFields },
  { title: "Previous Documents", fields: documentsFields },
  { title: "Bank Information", fields: bankFields },
  { title: "NSTP Card", fields: nstpFields },
  { title: "First Day at Vyro", fields: swagFields },
];

const defaultValues = steps.flatMap((step) => step.fields).reduce<Record<string, string>>((acc, field) => {
  acc[field.name] = "";
  return acc;
}, {});

export const OnboardingForm = () => {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>(defaultValues);
  const [isSubmitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const percentComplete = useMemo(() => Math.round(((step + 1) / steps.length) * 100), [step]);

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const validateStep = () => {
    const fields = steps[step].fields;
    for (const field of fields) {
      if (field.required && !values[field.name]?.trim()) {
        setError(`${field.label} is required`);
        return false;
      }
    }
    setError(null);
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.message ?? "Failed to submit");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-4xl border border-slate-200 bg-white p-8 text-center shadow-2xl shadow-slate-200/60">
        <p className="text-2xl font-semibold text-slate-900">Thank you!</p>
        <p className="mt-2 text-sm text-slate-500">Your information has been shared with the Vyro People Team.</p>
      </div>
    );
  }

  const fields = steps[step].fields;

  return (
    <div className="space-y-6 rounded-4xl border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-200/60">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Employee Directory :: Vyro - V1</p>
          <h1 className="text-3xl font-semibold text-slate-900">{steps[step].title}</h1>
          <p className="text-sm text-slate-500">Welcome to Vyro! Please share the requested information.</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-400">Progress</p>
          <p className="text-xl font-semibold text-slate-900">{percentComplete}%</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((field) => (
          <label key={field.name} className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
            {field.label}
            {renderField(field, values[field.name], (value) => handleChange(field.name, value))}
            {field.helper && <span className="text-xs font-normal text-slate-500">{field.helper}</span>}
          </label>
        ))}
      </div>
      {error && <p className="text-sm font-semibold text-rose-500">{error}</p>}
      <div className="flex flex-wrap justify-between gap-3">
        <button
          type="button"
          onClick={handleBack}
          disabled={step === 0}
          className="rounded-full border border-slate-300 px-6 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"
        >
          Back
        </button>
        {step === steps.length - 1 ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isSubmitting ? "Submitting…" : "Submit"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white"
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
};

const renderField = (field: FieldConfig, value: string, onChange: (value: string) => void) => {
  if (field.type === "textarea") {
    return (
      <textarea
        className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
      />
    );
  }
  if (field.type === "select") {
    return (
      <select
        className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={field.required}
      >
        <option value="">Select</option>
        {field.options?.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={field.type ?? "text"}
      className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder}
      required={field.required}
    />
  );
};

