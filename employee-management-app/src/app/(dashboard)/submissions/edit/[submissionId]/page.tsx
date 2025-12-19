import Link from "next/link";
import { getSubmissionById } from "@/lib/onboarding";
import SubmissionEditForm from "@/components/onboarding/submission-edit-form";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EditSubmissionPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { submissionId } = await params;
  const submission = await getSubmissionById(submissionId);

  if (!submission) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header className="rounded-4xl border border-slate-200 bg-white/80 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Vyro • People Operations</p>
            <h1 className="text-3xl font-semibold text-slate-900">Edit Submission</h1>
            <p className="text-sm text-slate-500">Update onboarding submission details.</p>
          </div>
          <Link
            href="/submissions"
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            ← Back to Submissions
          </Link>
        </div>
      </header>

      <SubmissionEditForm submission={submission} />
    </div>
  );
}
