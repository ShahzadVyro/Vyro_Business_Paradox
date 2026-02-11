"use client";

import { useMemo, useState } from "react";

const ALLOWED_FILE_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

interface FieldConfig {
  name: string;
  label: string;
  type?: "text" | "email" | "tel" | "date" | "textarea" | "select" | "file";
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
  { name: "Age", label: "Age", type: "text", placeholder: "Enter age in years" },
  { name: "Number_of_Children", label: "Number of Children", type: "text", placeholder: "0 if none" },
  { name: "Spouse_Name", label: "Spouse Name", placeholder: "If married" },
  { name: "Spouse_DOB", label: "Spouse Date of Birth", type: "date", placeholder: "If married" },
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
  { name: "Employment_Location", label: "Employment Location", placeholder: "City/Office location", required: true },
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
  { name: "Degree_Transcript_URL", label: "Degree / Latest Transcript", type: "file", helper: "PDF or image" },
  { name: "Last_Salary_Slip_URL", label: "Last Salary Slip", type: "file" },
  { name: "Experience_Letter_URL", label: "Previous Company Experience Letter", type: "file" },
  { name: "Resume_URL", label: "Resume / CV", type: "file", required: true },
];

const bankFields: FieldConfig[] = [
  { name: "Bank_Name", label: "Bank Name", required: true },
  { name: "Bank_Account_Title", label: "Bank Account Title", required: true },
  { name: "National_Tax_Number", label: "National Tax Number (NTN)" },
  { name: "Swift_Code_BIC", label: "Swift Code / BIC Code", required: true },
  { name: "Bank_Account_Number_IBAN", label: "Bank Account Number - IBAN", required: true },
];

const nstpFields: FieldConfig[] = [
  { name: "Passport_Photo_URL", label: "Passport Size Picture", type: "file", helper: "PDF or image" },
  { name: "CNIC_Front_URL", label: "CNIC Front", type: "file" },
  { name: "CNIC_Back_URL", label: "CNIC Back", type: "file" },
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

const fileFieldNames = [
  "Degree_Transcript_URL",
  "Last_Salary_Slip_URL",
  "Experience_Letter_URL",
  "Resume_URL",
  "Passport_Photo_URL",
  "CNIC_Front_URL",
  "CNIC_Back_URL",
];

const defaultValues = steps.flatMap((step) => step.fields).reduce<Record<string, string>>((acc, field) => {
  if (field.type !== "file") acc[field.name] = "";
  return acc;
}, {});

const initialFiles: Record<string, File | null> = {};
fileFieldNames.forEach((name) => {
  initialFiles[name] = null;
});

export const OnboardingForm = () => {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>(defaultValues);
  const [files, setFiles] = useState<Record<string, File | null>>(initialFiles);
  const [isSubmitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const percentComplete = useMemo(() => Math.round(((step + 1) / steps.length) * 100), [step]);

  const handleChange = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (name: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [name]: file }));
  };

  const validateFile = (file: File): string | null => {
    const type = file.type?.toLowerCase() || "";
    const allowed = ALLOWED_FILE_TYPES.some((t) => type === t || (t === "image/jpeg" && type === "image/jpg"));
    if (!allowed) return `Allowed types: PDF, PNG, JPEG, WebP`;
    if (file.size > MAX_FILE_SIZE_BYTES) return `File must be under ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`;
    return null;
  };

  const validateStep = () => {
    const fields = steps[step].fields;
    for (const field of fields) {
      if (field.type === "file") {
        const file = files[field.name];
        if (field.required && !file) {
          setError(`${field.label} is required`);
          return false;
        }
        if (file) {
          const fileError = validateFile(file);
          if (fileError) {
            setError(`${field.label}: ${fileError}`);
            return false;
          }
        }
      } else if (field.required && !values[field.name]?.trim()) {
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
      const formData = new FormData();
      for (const [key, value] of Object.entries(values)) {
        formData.append(key, value);
      }
      for (const name of fileFieldNames) {
        const file = files[name];
        if (file) formData.append(name, file);
      }
      const res = await fetch("/api/onboarding", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
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
            {renderField(
              field,
              values[field.name],
              (value) => handleChange(field.name, value),
              field.type === "file" ? files[field.name] : undefined,
              field.type === "file" ? (file) => handleFileChange(field.name, file) : undefined
            )}
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

const renderField = (
  field: FieldConfig,
  value: string,
  onChange: (value: string) => void,
  file?: File | null,
  onFileChange?: (file: File | null) => void
) => {
  if (field.type === "file") {
    return (
      <div className="flex flex-col gap-1">
        <input
          type="file"
          accept={ALLOWED_FILE_TYPES.join(",")}
          className="rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 file:mr-2 file:rounded-full file:border-0 file:bg-slate-100 file:px-4 file:py-1 file:text-sm file:font-semibold file:text-slate-700"
          onChange={(e) => onFileChange?.(e.target.files?.[0] ?? null)}
          required={field.required}
        />
        {file && <span className="text-xs text-slate-500">{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>}
      </div>
    );
  }
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

