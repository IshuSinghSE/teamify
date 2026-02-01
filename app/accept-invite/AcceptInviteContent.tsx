"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { acceptInviteViaFunction } from "@/lib/invites";

export default function AcceptInviteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [status, setStatus] = useState<
    "loading" | "signed-out" | "accepting" | "success" | "error"
  >("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid invite link. No token provided.");
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatus("signed-out");
        return;
      }
      setStatus("accepting");
      const result = await acceptInviteViaFunction(token);
      if (result.success) {
        setStatus("success");
        setMessage("You've joined the team.");
        setTimeout(() => router.push("/dashboard"), 2000);
      } else {
        setStatus("error");
        setMessage(result.error ?? "Failed to accept invite");
      }
    });

    return () => unsubscribe();
  }, [token, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
          <p className="mt-4 text-zinc-400">Checking invite…</p>
        </div>
      </div>
    );
  }

  if (status === "signed-out") {
    const authUrl = `/auth?redirect=${encodeURIComponent(`/accept-invite?token=${token}`)}`;
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
          <h1 className="text-xl font-semibold text-white">
            Sign in to accept the invite
          </h1>
          <p className="mt-3 text-sm text-zinc-500">
            Sign in with the email address that received the invite.
          </p>
          <Link
            href={authUrl}
            className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-500"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (status === "accepting") {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-blue-500" />
          <p className="mt-4 text-zinc-400">Accepting invite…</p>
        </div>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
          <p className="text-emerald-400">{message}</p>
          <p className="mt-2 text-sm text-zinc-500">
            Redirecting to dashboard…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
        <h1 className="text-xl font-semibold text-white">Invite error</h1>
        <p className="mt-3 text-red-400">{message}</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-500"
        >
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
