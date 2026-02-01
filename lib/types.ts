import { Timestamp } from "firebase/firestore";

/**
 * User Profile Document
 * Path: users/{userId}
 * Created immediately after signup
 */
export interface User {
  name: string;
  email: string;
  createdAt: Timestamp;
}

/**
 * Team Document
 * Path: teams/{teamId}
 * Represents a team entity
 */
export interface Team {
  name: string;
  createdBy: string; // userId
  createdAt: Timestamp;
}

/**
 * Team Member Document
 * Path: teams/{teamId}/members/{userId}
 * Tracks team membership and roles
 */
export interface TeamMember {
  role: "admin" | "member";
  joinedAt: Timestamp;
}

/**
 * Task Document
 * Path: teams/{teamId}/tasks/{taskId}
 * Tasks scoped to a team
 */
export interface Task {
  title: string;
  description: string;
  status: "pending" | "in_progress" | "done";
  createdBy: string; // userId
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Invite Document
 * Path: invites/{inviteId}
 * Email-based team invitations (managed by Cloud Functions)
 */
export interface Invite {
  teamId: string;
  email: string;
  role: "member";
  token: string;
  status: "pending" | "accepted" | "expired";
  createdBy: string; // userId
  createdAt: Timestamp;
  acceptedAt?: Timestamp;
}

/**
 * Audit Log Document (Optional)
 * Path: audit_logs/{logId}
 * Tracks key system events
 */
export interface AuditLog {
  action: string;
  performedBy: string; // userId
  teamId: string;
  timestamp: Timestamp;
}

/**
 * Client-safe User type (without Timestamp)
 * For use in components where Timestamp is converted to Date/string
 */
export interface UserData {
  name: string;
  email: string;
  createdAt: Date | string;
}

/**
 * Client-safe Team Member with user info
 */
export interface TeamMemberWithUser extends TeamMember {
  userId: string;
  name: string;
  email: string;
}
