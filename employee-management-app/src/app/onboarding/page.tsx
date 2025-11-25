import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export default function OnboardingPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-10">
      <div className="rounded-4xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
        <p className="font-semibold text-slate-900">Welcome to Vyro!</p>
        <p className="mt-1">
          We&apos;re excited to have you on board. Please complete this form so the People Team can set up your onboarding experience. The information
          you provide is used only for internal systems.
        </p>
      </div>
      <OnboardingForm />
    </main>
  );
}


