import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { firebaseConfig } from "./config";

export const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
const app = firebaseReady ? (getApps()[0] || initializeApp(firebaseConfig)) : undefined;
export const auth = app ? getAuth(app) : undefined;
