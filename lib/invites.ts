import { functions } from "./firebase";
import { httpsCallable } from "firebase/functions";

export interface CreateInviteRequest {
  teamId: string;
  email: string;
}

export interface CreateInviteResponse {
  success: boolean;
  inviteId?: string;
  error?: string;
}

/**
 * Call Cloud Function to create an invite and send email.
 * Caller must be team admin.
 */
export const createInviteViaFunction = async (
  teamId: string,
  email: string
): Promise<CreateInviteResponse> => {
  try {
    const createInvite = httpsCallable<CreateInviteRequest, CreateInviteResponse>(
      functions,
      "createInvite"
    );
    const result = await createInvite({ teamId, email });
    const data = result.data;
    if (data.success) {
      return { success: true, inviteId: data.inviteId };
    }
    return { success: false, error: data.error ?? "Unknown error" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
};

export interface AcceptInviteRequest {
  token: string;
}

export interface AcceptInviteResponse {
  success: boolean;
  teamId?: string;
  error?: string;
}

/**
 * Call Cloud Function to accept an invite (caller must be signed in with the invited email).
 */
export const acceptInviteViaFunction = async (
  token: string
): Promise<AcceptInviteResponse> => {
  try {
    const acceptInvite = httpsCallable<AcceptInviteRequest, AcceptInviteResponse>(
      functions,
      "acceptInvite"
    );
    const result = await acceptInvite({ token });
    const data = result.data;
    if (data?.success) {
      return { success: true, teamId: data.teamId };
    }
    return { success: false, error: data?.error ?? "Unknown error" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
};
