import { db } from "./firebase";
import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
  collectionGroup,
  query,
  where,
  documentId,
} from "firebase/firestore";
import { Team, TeamMember, TeamMemberWithUser } from "./types";

/**
 * Create a team and add the creator as an admin in the members subcollection.
 * Uses a write batch so both documents are written atomically.
 */
export const createTeam = async (
    name: string,
    creatorUid: string
): Promise<{ teamId: string | null; error: string | null }> => {
    try {
        const teamsCol = collection(db, "teams");
        // Create a new doc reference with an auto-generated ID
        const teamRef = doc(teamsCol);

        const batch = writeBatch(db);

        const teamData: Omit<Team, "createdAt"> & { createdAt: ReturnType<typeof serverTimestamp> } = {
            name,
            createdBy: creatorUid,
            createdAt: serverTimestamp(),
        };

        batch.set(teamRef, teamData);

        const memberRef = doc(db, `teams/${teamRef.id}/members/${creatorUid}`);
        const memberData: Omit<TeamMember, "joinedAt"> & { joinedAt: ReturnType<typeof serverTimestamp> } = {
            role: "admin",
            joinedAt: serverTimestamp(),
        };

        batch.set(memberRef, memberData);

        await batch.commit();

        return { teamId: teamRef.id, error: null };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { teamId: null, error: message };
    }
};

/** Team with id (for display) */
export interface TeamWithId extends Team {
    id: string;
}

/** Team with id and member count (for list views) */
export interface TeamWithMeta extends TeamWithId {
    memberCount: number;
}

/**
 * Get the number of members in a team (lightweight read).
 */
export const getTeamMemberCount = async (
    teamId: string
): Promise<number> => {
    try {
        const membersCol = collection(db, "teams", teamId, "members");
        const snap = await getDocs(membersCol);
        return snap.size;
    } catch {
        return 0;
    }
};

/**
 * Fetch a single team by id.
 */
export const getTeam = async (
    teamId: string
): Promise<{ team: TeamWithId | null; error: string | null }> => {
    try {
        const teamRef = doc(db, "teams", teamId);
        const snap = await getDoc(teamRef);
        if (!snap.exists()) {
            return { team: null, error: null };
        }
        const data = snap.data() as Omit<Team, "createdAt"> & { createdAt: unknown };
        const team: TeamWithId = {
            id: snap.id,
            name: data.name,
            createdBy: data.createdBy,
            createdAt: data.createdAt as Team["createdAt"],
        };
        return { team, error: null };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { team: null, error: message };
    }
};

/**
 * Fetch all members of a team and join with users collection for name/email.
 */
export const getTeamMembersWithUsers = async (
    teamId: string
): Promise<{ members: TeamMemberWithUser[]; error: string | null }> => {
    try {
        const membersCol = collection(db, "teams", teamId, "members");
        console.log(`[getTeamMembersWithUsers] Fetching members for team: ${teamId}`);
        const snap = await getDocs(membersCol);
        console.log(`[getTeamMembersWithUsers] Found ${snap.size} member documents`);
        const members: TeamMemberWithUser[] = [];

        for (const memberDoc of snap.docs) {
            const memberData = memberDoc.data() as Omit<TeamMember, "joinedAt"> & {
                joinedAt: unknown;
            };
            const userId = memberDoc.id;
            console.log(`[getTeamMembersWithUsers] Processing member: ${userId}, role: ${memberData.role}`);
            const userSnap = await getDoc(doc(db, "users", userId));
            const name = userSnap.exists()
                ? (userSnap.data() as { name?: string }).name ?? "—"
                : "—";
            const email = userSnap.exists()
                ? (userSnap.data() as { email?: string }).email ?? "—"
                : "—";
            console.log(`[getTeamMembersWithUsers] User ${userId}: name=${name}, email=${email}`);
            members.push({
                userId,
                role: memberData.role,
                joinedAt: memberData.joinedAt as TeamMember["joinedAt"],
                name,
                email,
            });
        }

        console.log(`[getTeamMembersWithUsers] Returning ${members.length} members`);
        return { members, error: null };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[getTeamMembersWithUsers] Error:`, message);
        return { members: [], error: message };
    }
};

/**
 * Fetch all teams the user belongs to (as creator or as member),
 * with member count for each. Runs "created by me" and "member of"
 * queries separately so one failure doesn't hide the other results.
 */
export const getTeamsForUser = async (
    uid: string
): Promise<{ teams: TeamWithMeta[]; error: string | null }> => {
    const teamIds = new Set<string>();

    // Teams created by user (primary source; must pass member check to read)
    try {
        const teamsCol = collection(db, "teams");
        const createdQuery = query(
            teamsCol,
            where("createdBy", "==", uid)
        );
        const createdSnap = await getDocs(createdQuery);
        createdSnap.docs.forEach((d) => teamIds.add(d.id));
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[getTeamsForUser] createdBy query failed:", message);
        return { teams: [], error: message };
    }

    // Teams where user is in members (e.g. invited); may need collection group index
    let memberQueryFailed = false;
    try {
        const membersGroup = collectionGroup(db, "members");
        const memberQuery = query(
            membersGroup,
            where(documentId(), "==", uid)
        );
        const memberSnap = await getDocs(memberQuery);
        memberSnap.docs.forEach((d) => {
            const teamId = d.ref.parent.parent?.id;
            if (teamId) teamIds.add(teamId);
        });
    } catch (err: unknown) {
        // Collection group often needs an index; don't fail the whole load
        memberQueryFailed = true;
        const message = err instanceof Error ? err.message : String(err);
        console.warn("[getTeamsForUser] collectionGroup members query failed, will fallback to per-team check:", message);
    }

    // Fallback: if collectionGroup failed, iterate all teams and check member doc existence.
    // if (memberQueryFailed) {
    //     try {
    //         const teamsCol = collection(db, "teams");
    //         const allTeamsSnap = await getDocs(teamsCol);
    //         for (const tdoc of allTeamsSnap.docs) {
    //             try {
    //                 const memberRef = doc(db, "teams", tdoc.id, "members", uid);
    //                 const memberSnap = await getDoc(memberRef);
    //                 if (memberSnap.exists()) teamIds.add(tdoc.id);
    //             } catch(err) {
    //                 // ignore per-team errors
    //                 console.error("[getTeamsForUser] per-team member check failed for team", tdoc.id, ":", err);
    //             }
    //         }
    //     } catch (err: unknown) {
    //         const message = err instanceof Error ? err.message : String(err);
    //         console.error("[getTeamsForUser] fallback per-team member check failed:", message);
    //     }
    // }

    const ids = Array.from(teamIds);
    const results = await Promise.all(
        ids.map(async (teamId) => {
            const [teamRes, memberCount] = await Promise.all([
                getTeam(teamId),
                getTeamMemberCount(teamId),
            ]);
            if (teamRes.error || !teamRes.team) return null;
            return { ...teamRes.team, memberCount } as TeamWithMeta;
        })
    );
    const teams = results.filter((t): t is TeamWithMeta => t !== null);

    return { teams, error: null };
};

/**
 * Delete a team and its related documents (members, tasks, invites).
 * Performs batched deletes; safe for small-to-medium teams.
 */
export const deleteTeam = async (
    teamId: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        // Delete members
        const membersCol = collection(db, "teams", teamId, "members");
        const membersSnap = await getDocs(membersCol);
        let batch = writeBatch(db);
        let ops = 0;
        for (const docSnap of membersSnap.docs) {
            batch.delete(doc(db, `teams/${teamId}/members/${docSnap.id}`));
            ops++;
            if (ops >= 450) {
                await batch.commit();
                batch = writeBatch(db);
                ops = 0;
            }
        }
        if (ops > 0) await batch.commit();

        // Delete tasks subcollection (if present)
        try {
            const tasksCol = collection(db, "teams", teamId, "tasks");
            const tasksSnap = await getDocs(tasksCol);
            batch = writeBatch(db);
            ops = 0;
            for (const tdoc of tasksSnap.docs) {
                batch.delete(doc(db, `teams/${teamId}/tasks/${tdoc.id}`));
                ops++;
                if (ops >= 450) {
                    await batch.commit();
                    batch = writeBatch(db);
                    ops = 0;
                }
            }
            if (ops > 0) await batch.commit();
        } catch {
            // ignore if tasks not present
        }

        // Delete invites where teamId == teamId (top-level collection)
        try {
            const invitesCol = collection(db, "invites");
            const q = query(invitesCol, where("teamId", "==", teamId));
            const invitesSnap = await getDocs(q);
            batch = writeBatch(db);
            ops = 0;
            for (const idoc of invitesSnap.docs) {
                batch.delete(doc(db, `invites/${idoc.id}`));
                ops++;
                if (ops >= 450) {
                    await batch.commit();
                    batch = writeBatch(db);
                    ops = 0;
                }
            }
            if (ops > 0) await batch.commit();
        } catch {
            // ignore
        }

        // Finally delete the team document
        const teamRef = doc(db, "teams", teamId);
        await deleteDoc(teamRef);

        return { success: true };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message };
    }
};
