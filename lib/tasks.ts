import { db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Task } from "./types";

export interface TaskWithId extends Task {
  id: string;
}

/**
 * Create a task in a team. Caller must be a team member (enforced by rules).
 */
export const createTask = async (
  teamId: string,
  createdBy: string,
  data: { title: string; description: string; status?: Task["status"] }
): Promise<{ taskId: string | null; error: string | null }> => {
  try {
    const tasksCol = collection(db, "teams", teamId, "tasks");
    const taskData = {
      title: data.title.trim(),
      description: (data.description ?? "").trim(),
      status: data.status ?? "pending",
      createdBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const ref = await addDoc(tasksCol, taskData);
    return { taskId: ref.id, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { taskId: null, error: message };
  }
};

/**
 * Get all tasks for a team. Caller must be a team member.
 */
export const getTasks = async (
  teamId: string
): Promise<{ tasks: TaskWithId[]; error: string | null }> => {
  try {
    const tasksCol = collection(db, "teams", teamId, "tasks");
    const snap = await getDocs(tasksCol);
    const tasks: TaskWithId[] = snap.docs.map((d) => {
      const data = d.data() as Omit<Task, "createdAt" | "updatedAt"> & {
        createdAt: unknown;
        updatedAt: unknown;
      };
      return {
        id: d.id,
        title: data.title,
        description: data.description,
        status: data.status,
        createdBy: data.createdBy,
        createdAt: data.createdAt as Task["createdAt"],
        updatedAt: data.updatedAt as Task["updatedAt"],
      };
    });
    return { tasks, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { tasks: [], error: message };
  }
};

/**
 * Update a task. Caller must be a team member.
 */
export const updateTask = async (
  teamId: string,
  taskId: string,
  updates: Partial<Pick<Task, "title" | "description" | "status">>
): Promise<{ error: string | null }> => {
  try {
    const taskRef = doc(db, "teams", teamId, "tasks", taskId);
    const toSet: Record<string, unknown> = { ...updates, updatedAt: serverTimestamp() };
    if (updates.title !== undefined) toSet.title = updates.title.trim();
    if (updates.description !== undefined) toSet.description = updates.description.trim();
    await updateDoc(taskRef, toSet);
    return { error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
};

/**
 * Delete a task. Only admins can delete (enforced by Firestore rules).
 */
export const deleteTask = async (
  teamId: string,
  taskId: string
): Promise<{ error: string | null }> => {
  try {
    const taskRef = doc(db, "teams", teamId, "tasks", taskId);
    await deleteDoc(taskRef);
    return { error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
};
