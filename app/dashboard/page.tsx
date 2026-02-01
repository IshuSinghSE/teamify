"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { signOut } from "@/lib/auth";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Timestamp } from "firebase/firestore";
import { User } from "@/lib/types";
import { createTeam, getTeamsForUser, type TeamWithMeta } from "@/lib/teams";

function formatTeamDate(value: Timestamp | undefined): string {
  const d = value?.toDate?.();
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const [user, setUser] = useState<Pick<User, "name" | "email"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);

  const [teamName, setTeamName] = useState("");
  const [teamError, setTeamError] = useState("");
  const [teamSuccess, setTeamSuccess] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamWithMeta[]>([]);

  const router = useRouter();

  const loadTeams = useCallback(async (authUid: string) => {
    const { teams: list, error } = await getTeamsForUser(authUid);
    if (!error) setTeams(list);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUid(authUser.uid);
        const userDoc = await getDoc(doc(db, "users", authUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          setUser({ name: userData.name, email: userData.email });
        }
        await loadTeams(authUser.uid);
        setLoading(false);
      } else {
        router.push("/auth");
      }
    });
    return () => unsubscribe();
  }, [router, loadTeams]);

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  const handleCreateTeam = async () => {
    setTeamError("");
    setTeamSuccess(null);
    if (!teamName.trim()) {
      setTeamError("Team name is required");
      return;
    }
    if (!uid) {
      setTeamError("User not authenticated");
      return;
    }
    const { teamId, error } = await createTeam(teamName.trim(), uid);
    if (error) {
      setTeamError(error);
    } else {
      setTeamSuccess(teamName.trim());
      setTeamName("");
      if (uid) await loadTeams(uid);
    }
  };

  const myTeams = teams.filter((t) => t.createdBy === uid);
  const otherTeams = teams.filter((t) => t.createdBy !== uid);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold tracking-tight text-white">
              Teamify
            </h1>
            {user && (
              <span className=" text-sm text-zinc-500 sm:inline">
                {user.name} · {user.email}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-500"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h2 className="mb-8 text-2xl font-semibold text-white">Dashboard</h2>

        <section className="mb-10">
          <div className="flex flex-wrap gap-3">
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="New team name"
              className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleCreateTeam}
              className="rounded-xl bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-500"
            >
              Create team
            </button>
          </div>
          {teamError && <p className="mt-2 text-sm text-red-400">{teamError}</p>}
          {teamSuccess && (
            <p className="mt-2 text-sm text-emerald-400">
              Team created: {teamSuccess}
            </p>
          )}
        </section>

        <section className="mb-10">
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500">
            My teams
          </h3>
          {myTeams.length === 0 ? (
            <p className="text-zinc-500">You haven&apos;t created any teams yet.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {myTeams.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/team/${t.id}`}
                    className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-left transition hover:border-zinc-700 hover:bg-zinc-800/50 hover:shadow-lg hover:shadow-zinc-900/50"
                  >
                    <span className="text-base font-semibold text-white">
                      {t.name}
                    </span>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
                      <span>{formatTeamDate(t.createdAt)}</span>
                      <span className="text-zinc-600">·</span>
                      <span>
                        {t.memberCount} {t.memberCount === 1 ? "member" : "members"}
                      </span>
                    </div>
                    <span className="mt-2 inline-block text-xs text-zinc-600">
                      Open team →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500">
            Other teams
          </h3>
          {otherTeams.length === 0 ? (
            <p className="text-zinc-500">
              You haven&apos;t joined any other teams yet.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {otherTeams.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/team/${t.id}`}
                    className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-left transition hover:border-zinc-700 hover:bg-zinc-800/50 hover:shadow-lg hover:shadow-zinc-900/50"
                  >
                    <span className="text-base font-semibold text-white">
                      {t.name}
                    </span>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
                      <span>{formatTeamDate(t.createdAt)}</span>
                      <span className="text-zinc-600">·</span>
                      <span>
                        {t.memberCount} {t.memberCount === 1 ? "member" : "members"}
                      </span>
                    </div>
                    <span className="mt-2 inline-block text-xs text-zinc-600">
                      Open team →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
