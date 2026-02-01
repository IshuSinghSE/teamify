import { db } from "./firebase";
import {
  collection,
  doc,
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
        const snap = await getDocs(membersCol);
        const members: TeamMemberWithUser[] = [];

        for (const memberDoc of snap.docs) {
            const memberData = memberDoc.data() as Omit<TeamMember, "joinedAt"> & {
                joinedAt: unknown;
            };
            const userId = memberDoc.id;
            const userSnap = await getDoc(doc(db, "users", userId));
            const name = userSnap.exists()
                ? (userSnap.data() as { name?: string }).name ?? "—"
                : "—";
            const email = userSnap.exists()
                ? (userSnap.data() as { email?: string }).email ?? "—"
                : "—";
            members.push({
                userId,
                role: memberData.role,
                joinedAt: memberData.joinedAt as TeamMember["joinedAt"],
                name,
                email,
            });
        }

        return { members, error: null };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { members: [], error: message };
    }
};

/**
 * Fetch all teams the user belongs to (as creator or as member).
 */
export const getTeamsForUser = async (
    uid: string
): Promise<{ teams: TeamWithId[]; error: string | null }> => {
    try {
        const teamIds = new Set<string>();

        // Teams created by user
        const teamsCol = collection(db, "teams");
        const createdQuery = query(
            teamsCol,
            where("createdBy", "==", uid)
        );
        const createdSnap = await getDocs(createdQuery);
        createdSnap.docs.forEach((d) => teamIds.add(d.id));

        // Teams where user is in members (e.g. invited)
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

        const teams: TeamWithId[] = [];
        for (const teamId of teamIds) {
            const { team, error } = await getTeam(teamId);
            if (error || !team) continue;
            teams.push(team);
        }

        return { teams, error: null };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { teams: [], error: message };
    }
};
