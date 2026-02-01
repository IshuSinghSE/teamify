"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.acceptInvite = exports.createInvite = void 0;
const functions = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
admin.initializeApp();
const db = admin.firestore();
const auth = admin.auth();
/** Base URL for the accept-invite page (e.g. https://yourapp.com) */
const ACCEPT_BASE_URL = process.env.ACCEPT_INVITE_BASE_URL || process.env.GCLOUD_PROJECT
    ? `https://${process.env.GCLOUD_PROJECT}.web.app`
    : "http://localhost:3000";
function getMailTransport() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (!host || !user || !pass)
        return null;
    return nodemailer.createTransport({
        host,
        port: port ? parseInt(port, 10) : 587,
        secure: port === "465",
        auth: { user, pass },
    });
}
async function sendInviteEmail(to, teamName, acceptLink) {
    const transport = getMailTransport();
    if (!transport) {
        console.warn("SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS). Invite created but email not sent.");
        return;
    }
    await transport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@teamify.app",
        to,
        subject: `You're invited to join ${teamName} on Teamify`,
        text: `You have been invited to join the team "${teamName}" on Teamify. Accept the invite by clicking: ${acceptLink}`,
        html: `<p>You have been invited to join the team <strong>${teamName}</strong> on Teamify.</p><p><a href="${acceptLink}">Accept invite</a></p>`,
    });
}
exports.createInvite = functions.onCall({ enforceAppCheck: false }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        return { success: false, error: "Unauthorized" };
    }
    const { teamId, email } = request.data;
    if (!teamId || !email || typeof email !== "string") {
        return { success: false, error: "teamId and email are required" };
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
        return { success: false, error: "Valid email is required" };
    }
    const memberRef = db.doc(`teams/${teamId}/members/${uid}`);
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) {
        return { success: false, error: "You are not a member of this team" };
    }
    const role = memberSnap.data()?.role;
    if (role !== "admin") {
        return { success: false, error: "Only admins can invite members" };
    }
    const teamSnap = await db.doc(`teams/${teamId}`).get();
    if (!teamSnap.exists) {
        return { success: false, error: "Team not found" };
    }
    const teamName = teamSnap.data()?.name || "the team";
    const token = crypto.randomBytes(32).toString("hex");
    const inviteRef = db.collection("invites").doc();
    await inviteRef.set({
        teamId,
        email: normalizedEmail,
        role: "member",
        token,
        status: "pending",
        createdBy: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const acceptLink = `${ACCEPT_BASE_URL}/accept-invite?token=${token}`;
    await sendInviteEmail(normalizedEmail, teamName, acceptLink);
    return { success: true, inviteId: inviteRef.id };
});
exports.acceptInvite = functions.onCall({ enforceAppCheck: false }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        return { success: false, error: "Unauthorized" };
    }
    const { token } = request.data;
    if (!token || typeof token !== "string") {
        return { success: false, error: "Token is required" };
    }
    const invitesSnap = await db
        .collection("invites")
        .where("token", "==", token)
        .where("status", "==", "pending")
        .limit(1)
        .get();
    if (invitesSnap.empty) {
        return { success: false, error: "Invalid or expired invite" };
    }
    const inviteDoc = invitesSnap.docs[0];
    const invite = inviteDoc.data();
    const userRecord = await auth.getUser(uid);
    const userEmail = (userRecord.email || "").trim().toLowerCase();
    if (userEmail !== invite.email) {
        return {
            success: false,
            error: "This invite was sent to a different email. Sign in with that account.",
        };
    }
    const memberRef = db.doc(`teams/${invite.teamId}/members/${uid}`);
    const existing = await memberRef.get();
    if (existing.exists) {
        await inviteDoc.ref.update({
            status: "accepted",
            acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, teamId: invite.teamId };
    }
    const batch = db.batch();
    batch.set(memberRef, {
        role: invite.role || "member",
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    batch.update(inviteDoc.ref, {
        status: "accepted",
        acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await batch.commit();
    return { success: true, teamId: invite.teamId };
});
