import React from "react";

type AuthDemoPageProps = {
  title: string;
  intro: string;
  steps: string[];
  children: React.ReactNode;
};

export default function AuthDemoPage({
  title,
  intro,
  steps,
  children,
}: AuthDemoPageProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-8 px-4 py-16 text-slate-100">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{intro}</p>
        <ol className="mt-4 list-inside list-decimal space-y-1 text-sm text-slate-500">
          {steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </header>
      {children}
    </main>
  );
}
