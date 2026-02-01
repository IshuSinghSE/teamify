"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { signOut } from "@/lib/auth";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { User } from "@/lib/types";
import {
  getTeam,
  getTeamMembersWithUsers,
  TeamWithId,
  deleteTeam,
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

const STATUS_OPTIONS: Task["status"][] = ["pending", "in_progress", "done"];

export default function TeamPageClient() {
  const params = useParams();
  const teamId = typeof params.teamId === "string" ? params.teamId : null;
  const router = useRouter();

  const [user, setUser] = useState<Pick<User, "name" | "email"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);

  const [team, setTeam] = useState<TeamWithId | null>(null);
  const [members, setMembers] = useState<TeamMemberWithUser[]>([]);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [teamLoading, setTeamLoading] = useState(true);

  const [tasks, setTasks] = useState<TaskWithId[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDesc, setEditingDesc] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskError, setTaskError] = useState("");
  const [taskSuccess, setTaskSuccess] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [deletingTeam, setDeletingTeam] = useState(false);

  const loadTeamData = useCallback(async (id: string) => {
    setTeamLoading(true);
    setMembersError(null);
    console.log('[TeamPageClient] Loading team data for:', id);
    const [teamRes, membersRes, tasksRes] = await Promise.all([
      getTeam(id),
      getTeamMembersWithUsers(id),
      getTasks(id),
    ]);
    setTeamLoading(false);
    console.log('[TeamPageClient] Team:', teamRes.team);
    console.log('[TeamPageClient] Members:', membersRes.members, 'Error:', membersRes.error);
    console.log('[TeamPageClient] Tasks:', tasksRes.tasks);
    if (teamRes.team) setTeam(teamRes.team);
    if (membersRes.error) setMembersError(membersRes.error);
    if (membersRes.members.length >= 0) setMembers(membersRes.members);
    if (!tasksRes.error) setTasks(tasksRes.tasks);
  }, []);

  const loadTasks = useCallback(async (id: string) => {
    setTasksLoading(true);
    const { tasks: list, error } = await getTasks(id);
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
        setLoading(false);
      } else {
        router.push("/auth");
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (teamId) {
      const id = teamId;
      const handle = setTimeout(() => {
        void loadTeamData(id);
      }, 0);
      return () => clearTimeout(handle);
    } else {
      const handle = setTimeout(() => {
        setTeam(null);
        setMembers([]);
        setTasks([]);
      }, 0);
      return () => clearTimeout(handle);
    }
  }, [teamId, loadTeamData]);

  const handleLogout = async () => {
    await signOut();
    router.push("/");
  };

  const isAdmin =
    teamId &&
    uid &&
    members.some((m) => m.userId === uid && m.role === "admin");

  const handleInvite = async () => {
    setInviteError("");
    setInviteSuccess("");
    if (!inviteEmail.trim() || !teamId) return;
    setInviteLoading(true);
    const result = await createInviteViaFunction(teamId, inviteEmail.trim());
    setInviteLoading(false);
    if (result.success) {
      setInviteSuccess(`Invite sent to ${inviteEmail.trim()}`);
      setInviteEmail("");
    } else {
      setInviteError(result.error ?? "Failed to send invite");
    }
  };

  const handleDeleteTeam = async () => {
    if (!teamId || !team) return;
    const ok = window.confirm(
      `Delete team "${team.name}"? This will remove the team and all its data. This cannot be undone.`
    );
    if (!ok) return;
    setDeletingTeam(true);
    const res = await deleteTeam(teamId);
    setDeletingTeam(false);
    if (res.success) {
      // navigate back to dashboard
      router.push("/dashboard");
    } else {
      setInviteError(res.error ?? "Failed to delete team");
    }
  };

  const handleCreateTask = async () => {
    setTaskError("");
    setTaskSuccess("");
    if (!teamId || !uid) return;
    if (!taskTitle.trim()) {
      setTaskError("Title is required");
      return;
    }
    const { error } = await createTask(teamId, uid, {
      title: taskTitle.trim(),
      description: taskDesc.trim(),
    });
    if (error) {
      setTaskError(error);
    } else {
      setTaskSuccess("Task created");
      setTaskTitle("");
      setTaskDesc("");
      loadTasks(teamId);
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: Task["status"]) => {
    if (!teamId) return;
    await updateTask(teamId, taskId, { status });
    loadTasks(teamId);
  };

  const startEditTask = (task: TaskWithId) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
    setEditingDesc(task.description || "");
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditingTitle("");
    setEditingDesc("");
  };

  const saveEditTask = async (taskId: string) => {
    if (!teamId) return;
    const updates: Partial<Pick<Task, "title" | "description">> = {};
    updates.title = editingTitle;
    updates.description = editingDesc;
    const { error } = await updateTask(teamId, taskId, updates);
    if (error) {
      setTaskError(error);
    } else {
      cancelEditTask();
      loadTasks(teamId);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!teamId) return;
    const { error } = await deleteTask(teamId, taskId);
    if (error) setTaskError(error);
    else loadTasks(teamId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!teamId) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400">Invalid team.</p>
        <Link href="/dashboard" className="ml-2 text-blue-400 hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-zinc-500 hover:text-zinc-300"
              aria-label="Back to dashboard"
            >
              ← Dashboard
            </Link>
            <span className="text-zinc-600">·</span>
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
        {teamLoading ? (
          <p className="text-zinc-500">Loading team...</p>
        ) : !team ? (
          <div>
            <p className="text-zinc-500">Team not found or you don’t have access.</p>
            <Link href="/dashboard" className="mt-2 inline-block text-blue-400 hover:underline">
              Back to dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            <h2 className="text-2xl font-semibold text-white">{team.name}</h2>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
              <h3 className="mb-4 text-lg font-semibold text-white">Team details</h3>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium uppercase text-zinc-500">Name</dt>
                  <dd className="mt-0.5 text-white">{team.name}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-zinc-500">Created</dt>
                  <dd className="mt-0.5 text-zinc-400">{formatDate(team.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase text-zinc-500">Created by</dt>
                  <dd className="mt-0.5 text-zinc-400">
                    {members.find((m) => m.userId === team.createdBy)?.name ?? team.createdBy}
                  </dd>
                </div>
              </dl>

              <div className="mt-6">
                <h4 className="mb-2 text-sm font-medium text-zinc-400">
                  Members ({members.length})
                </h4>
                {membersError && (
                  <p className="mb-2 text-sm text-red-400">
                    Error loading members: {membersError}
                  </p>
                )}
                {members.length === 0 && !membersError ? (
                  <p className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-zinc-500">
                    No members found
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
                    {members.map((m) => (
                      <li
                        key={m.userId}
                        className="flex items-center justify-between px-4 py-3"
                      >
                        <div>
                          <span className="text-white">{m.name}</span>
                          <span className="ml-2 text-sm text-zinc-500">{m.email}</span>
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
                )}
              </div>

              {isAdmin && (
                <div className="mt-6 border-t border-zinc-800 pt-6">
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
                    <p className="mt-2 text-sm text-emerald-400">{inviteSuccess}</p>
                  )}
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={handleDeleteTeam}
                      disabled={deletingTeam}
                      className="rounded-xl bg-red-700 px-4 py-2 font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
                    >
                      {deletingTeam ? "Deleting…" : "Delete team"}
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
              <h3 className="mb-4 text-lg font-semibold text-white">Tasks</h3>
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
              {taskError && <p className="mb-2 text-sm text-red-400">{taskError}</p>}
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
                        {editingTaskId === task.id ? (
                          <div>
                            <input
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              disabled={!isAdmin}
                              className={`w-full rounded-md border px-2 py-1 text-white bg-zinc-900/80 placeholder-zinc-500 ${!isAdmin ? 'opacity-60' : ''}`}
                            />
                            <textarea
                              value={editingDesc}
                              onChange={(e) => setEditingDesc(e.target.value)}
                              className="mt-2 w-full rounded-md border px-2 py-1 text-sm text-zinc-200 bg-zinc-900/80 placeholder-zinc-500"
                            />
                          </div>
                        ) : (
                          <>
                            <p className="font-medium text-white">{task.title}</p>
                            {task.description && (
                              <p className="mt-0.5 text-sm text-zinc-500">
                                {task.description}
                              </p>
                            )}
                          </>
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

                        {editingTaskId === task.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEditTask(task.id)}
                              className="rounded-md bg-emerald-600 px-3 py-1 text-sm text-white"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditTask}
                              className="rounded-md bg-zinc-700 px-3 py-1 text-sm text-zinc-200"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditTask(task)}
                              className="rounded-md bg-blue-600 px-3 py-1 text-sm text-white"
                            >
                              Edit
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(task.id)}
                                className="rounded-lg bg-red-600/20 px-2.5 py-1.5 text-sm text-red-400 transition hover:bg-red-600/30"
                              >
                                Delete
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
