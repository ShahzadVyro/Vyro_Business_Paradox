import Link from "next/link";
import { listOnboardingSubmissions } from "@/lib/onboarding";
import SubmissionsPageClient from "@/components/onboarding/submissions-page-client";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const submissions = await listOnboardingSubmissions();

  return <SubmissionsPageClient initialSubmissions={submissions} />;
}
