/// <reference types="node" />

import "dotenv/config";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const email = process.argv[2];

if (!email) {
  console.error("Usage: npx tsx scripts/set-admin.ts your-email@example.com");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const auth = getAuth();
const user = await auth.getUserByEmail(email);

await auth.setCustomUserClaims(user.uid, {
  ...(user.customClaims || {}),
  role: "admin",
});

console.log(`✅ ${email} is now an admin.`);