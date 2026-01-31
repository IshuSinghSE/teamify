// Format Firebase Auth error codes to user-friendly messages
export function formatAuthError(error: string): string {
  if (!error) return "";
  if (error.includes("auth/invalid-credential") || error.includes("auth/wrong-password")) {
    return "Incorrect email or password.";
  }
  if (error.includes("auth/user-not-found")) {
    return "No account found with this email.";
  }
  if (error.includes("auth/email-already-in-use")) {
    return "This email is already registered.";
  }
  if (error.includes("auth/weak-password")) {
    return "Password should be at least 6 characters.";
  }
  if (error.includes("auth/invalid-email")) {
    return "Please enter a valid email address.";
  }
  if (error.includes("auth/too-many-requests")) {
    return "Too many attempts. Please try again later.";
  }
  return "An error occurred. Please try again.";
}