import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
          <h1 className="text-xl font-semibold tracking-tight text-white">
            Teamify
          </h1>
          <Link
            href="/auth"
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Team Task Manager
        </h2>
        <p className="mt-6 text-lg text-zinc-400">
          Create teams, invite members, and manage tasks together. Simple,
          fast, and built for collaboration.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/auth"
            className="rounded-xl bg-blue-600 px-8 py-4 text-base font-medium text-white transition hover:bg-blue-500"
          >
            Get started
          </Link>
          <Link
            href="/auth?redirect=/dashboard"
            className="rounded-xl border border-zinc-700 bg-zinc-900/50 px-8 py-4 text-base font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800/50"
          >
            Log in
          </Link>
        </div>
      </main>
    </div>
  );
}
