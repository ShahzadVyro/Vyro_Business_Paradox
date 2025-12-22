"use client";

import { useState, useRef, useEffect } from "react";

interface EditableCellProps {
  value: number | string | null;
  field: string;
  currency?: string;
  onSave: (field: string, value: number | string | null) => Promise<void>;
  type?: "number" | "text" | "select";
  options?: { value: string; label: string }[];
  formatValue?: (value: number | string | null) => string;
  parseValue?: (value: string) => number | string | null;
  className?: string;
}

export default function EditableCell({
  value,
  field,
  currency,
  onSave,
  type = "number",
  options,
  formatValue,
  parseValue,
  className = "px-2 py-2 text-slate-600",
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (type === "number") {
      setEditValue(value === null || value === undefined ? "" : String(value));
    } else {
      setEditValue(value === null || value === undefined ? "" : String(value));
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let finalValue: number | string | null = editValue;
      
      if (type === "number") {
        if (parseValue) {
          finalValue = parseValue(editValue);
        } else {
          finalValue = editValue === "" || editValue === "-" ? null : parseFloat(editValue);
          if (isNaN(finalValue as number)) {
            finalValue = null;
          }
        }
      } else if (type === "text") {
        finalValue = editValue === "" ? null : editValue;
      }

      await onSave(field, finalValue);
      setIsEditing(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1000);
    } catch (error) {
      console.error("Error saving:", error);
      alert("Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  };

  const formatDisplayValue = (val: number | string | null): string => {
    if (formatValue) {
      return formatValue(val);
    }
    if (val === null || val === undefined) return "—";
    if (type === "number") {
      return typeof val === "number" ? val.toLocaleString() : String(val);
    }
    return String(val);
  };

  if (isEditing) {
    if (type === "select" && options) {
      return (
        <td className={className}>
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            className="w-full rounded border border-blue-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </td>
      );
    }

    if (type === "text" && field.includes("Comments")) {
      return (
        <td className={className}>
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            rows={2}
            className="w-full rounded border border-blue-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </td>
      );
    }

    return (
      <td className={className}>
        <div className="flex items-center gap-1">
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type === "number" ? "number" : "text"}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            step={type === "number" ? "0.01" : undefined}
            className="w-full rounded border border-blue-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {isSaving && (
            <span className="text-xs text-blue-500">Saving...</span>
          )}
        </div>
      </td>
    );
  }

  // Special formatting for status fields
  const isStatusField = field.includes("Status");
  const displayValue = formatDisplayValue(value);
  
  return (
    <td
      className={`${className} cursor-pointer hover:bg-blue-50 group relative`}
      onClick={handleStartEdit}
      title="Click to edit"
    >
      <div className="flex items-center gap-1">
        {isStatusField && field === "Salary_Status" ? (
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            value === "Released" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
          }`}>
            {displayValue}
          </span>
        ) : isStatusField && field === "PaySlip_Status" ? (
          <span className={`px-2 py-1 rounded text-xs ${
            value === "Sent" ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"
          }`}>
            {displayValue}
          </span>
        ) : (
          <span>{displayValue}</span>
        )}
        <svg
          className="h-3 w-3 opacity-0 group-hover:opacity-50 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </div>
      {showSuccess && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500 text-xs">✓</span>
      )}
    </td>
  );
}
