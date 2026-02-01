import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut as firebaseSignOut, User as FirebaseUser } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import { User } from "./types";

export const signUp = async (
  email: string,
  password: string,
  name: string
): Promise<{ user: FirebaseUser | null; error: string | null }> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userData: Omit<User, "createdAt"> & { createdAt: ReturnType<typeof serverTimestamp> } = {
      name,
      email,
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(db, "users", user.uid), userData);

    return { user, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { user: null, error: message };
  }
};

export const signIn = async (
  email: string,
  password: string
): Promise<{ user: FirebaseUser | null; error: string | null }> => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { user: null, error: message };
  }
};

export const signOut = async (): Promise<{ error: string | null }> => {
  try {
    await firebaseSignOut(auth);
    return { error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { error: message };
  }
};
