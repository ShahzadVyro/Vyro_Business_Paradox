"use client";

import { useEffect, useCallback } from "react";

interface DocumentViewerProps {
  open: boolean;
  onClose: () => void;
  previewUrl: string | null;
  downloadUrl: string | null;
  title: string;
}

export default function DocumentViewer({
  open,
  onClose,
  previewUrl,
  downloadUrl,
  title,
}: DocumentViewerProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, handleEscape]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex h-full max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-4 py-3">
          <h2 className="truncate text-lg font-semibold text-slate-900">{title}</h2>
          <div className="flex items-center gap-2">
            {downloadUrl && (
              <a
                href={downloadUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Download
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-b-2xl bg-slate-100">
          {previewUrl ? (
            <iframe
              src={previewUrl}
              title={title}
              className="h-full w-full border-0"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500">
              No preview available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
