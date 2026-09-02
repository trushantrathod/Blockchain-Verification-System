import {
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";

import { auth } from "./firebase";

const requireAuth = () => {
  if (!auth) {
    throw new Error(
      "Firebase is not configured. Add the VITE_FIREBASE_* values first."
    );
  }

  return auth;
};

export const login = (email: string, password: string) =>
  signInWithEmailAndPassword(requireAuth(), email, password);

export const logout = () => signOut(requireAuth());

export const token = (user: User) => user.getIdToken();

export const roleOf = async (user: User) =>
  (await user.getIdTokenResult(true)).claims.role as string | undefined;