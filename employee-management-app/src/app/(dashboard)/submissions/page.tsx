import Link from "next/link";
import { listOnboardingSubmissions } from "@/lib/onboarding";
import SubmissionsPageClient from "@/components/onboarding/submissions-page-client";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const submissions = await listOnboardingSubmissions();

  return <SubmissionsPageClient initialSubmissions={submissions} />;
}
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const filteredSubmissions = useMemo(() => {
    let filtered = initialSubmissions;

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (sub) =>
          sub.Full_Name?.toLowerCase().includes(searchLower) ||
          sub.Official_Email?.toLowerCase().includes(searchLower) ||
          sub.Department?.toLowerCase().includes(searchLower) ||
          sub.Designation?.toLowerCase().includes(searchLower) ||
          sub.Submission_ID?.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter((sub) => sub.Status === statusFilter);
    }

    return filtered;
  }, [initialSubmissions, search, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts = { all: initialSubmissions.length, pending: 0, confirmed: 0, cancelled: 0 };
    initialSubmissions.forEach((sub) => {
      if (sub.Status === "pending") counts.pending++;
      else if (sub.Status === "confirmed") counts.confirmed++;
      else if (sub.Status === "cancelled") counts.cancelled++;
    });
    return counts;
  }, [initialSubmissions]);

  return (
    <div className="space-y-6">
      <header className="rounded-4xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Vyro • People Operations</p>
            <h1 className="text-3xl font-semibold text-slate-900">Onboarding Submissions</h1>
            <p className="text-sm text-slate-500">View and manage employee onboarding submissions.</p>
          </div>
          <Link
            href="/onboarding"
            className="inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition"
          >
            + New Submission
          </Link>
        </div>
      </header>

      {/* Filters */}
      <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <SearchBar value={search} onChange={setSearch} />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter(null)}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                statusFilter === null
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All ({statusCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("pending")}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                statusFilter === "pending"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Pending ({statusCounts.pending})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("confirmed")}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                statusFilter === "confirmed"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Confirmed ({statusCounts.confirmed})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("cancelled")}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                statusFilter === "cancelled"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Cancelled ({statusCounts.cancelled})
            </button>
          </div>
        </div>
      </div>

      {/* Submissions Table */}
      <SubmissionsTable submissions={filteredSubmissions} />
    </div>
  );
}
