"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { signOut } from "@/lib/auth";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { User } from "@/lib/types";
import {
  createTeam,
  getTeamsForUser,
  getTeam,
  getTeamMembersWithUsers,
  TeamWithId,
} from "@/lib/teams";
import {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
  TaskWithId,
} from "@/lib/tasks";
import { createInviteViaFunction } from "@/lib/invites";
import type { TeamMemberWithUser } from "@/lib/types";
import type { Task } from "@/lib/types";
import { Timestamp } from "firebase/firestore";

function formatDate(value: Timestamp | Date | undefined): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : (value as Timestamp)?.toDate?.();
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const STATUS_OPTIONS: Task["status"][] = ["todo", "in_progress", "done"];

export default function DashboardPage() {
  const [user, setUser] = useState<Pick<User, "name" | "email"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);

  const [teamName, setTeamName] = useState("");
  const [teamError, setTeamError] = useState("");
  const [teamSuccess, setTeamSuccess] = useState<string | null>(null);
  const [teams, setTeams] = useState<TeamWithId[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamWithId | null>(null);
  const [members, setMembers] = useState<TeamMemberWithUser[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [tasks, setTasks] = useState<TaskWithId[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskError, setTaskError] = useState("");
  const [taskSuccess, setTaskSuccess] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  const router = useRouter();

  const loadTeams = useCallback(async (authUid: string) => {
    const { teams: list, error } = await getTeamsForUser(authUid);
    if (!error) setTeams(list);
  }, []);

  const loadSelectedTeamDetails = useCallback(async (teamId: string) => {
    setMembersLoading(true);
    const [teamRes, membersRes, tasksRes] = await Promise.all([
      getTeam(teamId),
      getTeamMembersWithUsers(teamId),
      getTasks(teamId),
    ]);
    setMembersLoading(false);
    if (teamRes.team) setSelectedTeam(teamRes.team);
    if (membersRes.members.length >= 0) setMembers(membersRes.members);
    if (!tasksRes.error) setTasks(tasksRes.tasks);
  }, []);

  const loadTasks = useCallback(async (teamId: string) => {
    setTasksLoading(true);
    const { tasks: list, error } = await getTasks(teamId);
    setTasksLoading(false);
    if (!error) setTasks(list);
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

  useEffect(() => {
    if (selectedTeamId) {
      loadSelectedTeamDetails(selectedTeamId);
    } else {
      setSelectedTeam(null);
      setMembers([]);
      setTasks([]);
    }
  }, [selectedTeamId, loadSelectedTeamDetails]);

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
      if (teamId) setSelectedTeamId(teamId);
    }
  };

  const isAdminOfSelectedTeam =
    selectedTeamId &&
    uid &&
    members.some((m) => m.userId === uid && m.role === "admin");

  const handleInvite = async () => {
    setInviteError("");
    setInviteSuccess("");
    if (!inviteEmail.trim()) {
      setInviteError("Email is required");
      return;
    }
    if (!selectedTeamId) return;
    setInviteLoading(true);
    const result = await createInviteViaFunction(selectedTeamId, inviteEmail.trim());
    setInviteLoading(false);
    if (result.success) {
      setInviteSuccess(`Invite sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
    } else {
      setInviteError(result.error ?? "Failed to send invite");
    }
  };

  const handleCreateTask = async () => {
    setTaskError("");
    setTaskSuccess("");
    if (!selectedTeamId || !uid) return;
    if (!taskTitle.trim()) {
      setTaskError("Title is required");
      return;
    }
    const { taskId, error } = await createTask(selectedTeamId, uid, {
      title: taskTitle.trim(),
      description: taskDesc.trim(),
    });
    if (error) {
      setTaskError(error);
    } else {
      setTaskSuccess("Task created");
      setTaskTitle("");
      setTaskDesc("");
      loadTasks(selectedTeamId);
    }
  };

  const handleUpdateTaskStatus = async (
    taskId: string,
    status: Task["status"]
  ) => {
    if (!selectedTeamId) return;
    await updateTask(selectedTeamId, taskId, { status });
    loadTasks(selectedTeamId);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!selectedTeamId) return;
    const { error } = await deleteTask(selectedTeamId, taskId);
    if (error) setTaskError(error);
    else loadTasks(selectedTeamId);
  };

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
              <span className="hidden text-sm text-zinc-500 sm:inline">
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

        {/* Create team */}
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
          {teamError && (
            <p className="mt-2 text-sm text-red-400">{teamError}</p>
          )}
          {teamSuccess && (
            <p className="mt-2 text-sm text-emerald-400">
              Team created: {teamSuccess}
            </p>
          )}
        </section>

        {/* Team list */}
        <section className="mb-10">
          <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500">
            Your teams
          </h3>
          {teams.length === 0 ? (
            <p className="text-zinc-500">You haven&apos;t joined any teams yet.</p>
          ) : (
            <ul className="space-y-1">
              {teams.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedTeamId(t.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      selectedTeamId === t.id
                        ? "border-blue-500/50 bg-blue-500/10 text-white"
                        : "border-zinc-800 bg-zinc-900/50 text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800/50"
                    }`}
                  >
                    <span className="font-medium">{t.name}</span>
                    <span className="ml-2 text-xs text-zinc-500">#{t.id.slice(0, 8)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Selected team: details, members, invite, tasks */}
        {selectedTeamId && (
          <div className="space-y-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
            <h3 className="text-lg font-semibold text-white">Team details</h3>
            {membersLoading ? (
              <p className="text-zinc-500">Loading...</p>
            ) : selectedTeam ? (
              <>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium uppercase text-zinc-500">
                      Name
                    </dt>
                    <dd className="mt-0.5 text-white">{selectedTeam.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-zinc-500">
                      Created
                    </dt>
                    <dd className="mt-0.5 text-zinc-400">
                      {formatDate(selectedTeam.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-zinc-500">
                      Created by
                    </dt>
                    <dd className="mt-0.5 text-zinc-400">
                      {members.find((m) => m.userId === selectedTeam.createdBy)
                        ?.name ?? selectedTeam.createdBy}
                    </dd>
                  </div>
                </dl>

                <div>
                  <h4 className="mb-2 text-sm font-medium text-zinc-400">
                    Members ({members.length})
                  </h4>
                  <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
                    {members.map((m) => (
                      <li
                        key={m.userId}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <div>
                          <span className="text-white">{m.name}</span>
                          <span className="ml-2 text-sm text-zinc-500">
                            {m.email}
                          </span>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            m.role === "admin"
                              ? "bg-blue-500/20 text-blue-300"
                              : "bg-zinc-700 text-zinc-400"
                          }`}
                        >
                          {m.role}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {isAdminOfSelectedTeam && (
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-zinc-400">
                      Invite by email
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="colleague@example.com"
                        className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900/50 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={handleInvite}
                        disabled={inviteLoading}
                        className="rounded-xl bg-emerald-600 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {inviteLoading ? "Sending…" : "Invite"}
                      </button>
                    </div>
                    {inviteError && (
                      <p className="mt-2 text-sm text-red-400">{inviteError}</p>
                    )}
                    {inviteSuccess && (
                      <p className="mt-2 text-sm text-emerald-400">
                        {inviteSuccess}
                      </p>
                    )}
                  </div>
                )}

                {/* Tasks */}
                <div className="border-t border-zinc-800 pt-8">
                  <h4 className="mb-4 text-sm font-medium text-zinc-400">
                    Tasks
                  </h4>
                  <div className="mb-4 flex flex-wrap gap-2">
                    <input
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="Task title"
                      className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      value={taskDesc}
                      onChange={(e) => setTaskDesc(e.target.value)}
                      placeholder="Description (optional)"
                      className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleCreateTask}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
                    >
                      Add task
                    </button>
                  </div>
                  {taskError && (
                    <p className="mb-2 text-sm text-red-400">{taskError}</p>
                  )}
                  {taskSuccess && (
                    <p className="mb-2 text-sm text-emerald-400">{taskSuccess}</p>
                  )}
                  {tasksLoading ? (
                    <p className="text-zinc-500">Loading tasks...</p>
                  ) : tasks.length === 0 ? (
                    <p className="rounded-xl border border-zinc-800 bg-zinc-900/30 py-8 text-center text-zinc-500">
                      No tasks yet. Add one above.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {tasks.map((task) => (
                        <li
                          key={task.id}
                          className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-white">{task.title}</p>
                            {task.description && (
                              <p className="mt-0.5 text-sm text-zinc-500">
                                {task.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <select
                              value={task.status}
                              onChange={(e) =>
                                handleUpdateTaskStatus(
                                  task.id,
                                  e.target.value as Task["status"]
                                )
                              }
                              className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                  {s.replace("_", " ")}
                                </option>
                              ))}
                            </select>
                            {isAdminOfSelectedTeam && (
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(task.id)}
                                className="rounded-lg bg-red-600/20 px-2.5 py-1.5 text-sm text-red-400 transition hover:bg-red-600/30"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <p className="text-zinc-500">Could not load team.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
