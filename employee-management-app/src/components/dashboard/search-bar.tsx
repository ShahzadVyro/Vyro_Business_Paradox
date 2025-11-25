"use client";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

const SearchBar = ({ value, onChange }: Props) => (
  <div className="relative flex-1">
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Search name, email, or Employee ID"
      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
    />
    <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs text-slate-400">
      ⌘K
    </span>
  </div>
);

export default SearchBar;

