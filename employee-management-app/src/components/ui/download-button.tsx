"use client";

interface DownloadButtonProps {
  label: string;
  href: string;
  variant?: "primary" | "secondary";
}

const buttonStyles = {
  primary: "bg-slate-900 text-white hover:bg-slate-800",
  secondary: "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
};

const DownloadButton = ({ label, href, variant = "secondary" }: DownloadButtonProps) => {
  const handleClick = () => {
    const url = new URL(href, window.location.origin);
    window.open(url.toString(), "_blank");
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${buttonStyles[variant]}`}
    >
      {label}
    </button>
  );
};

export default DownloadButton;


