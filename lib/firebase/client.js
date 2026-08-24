const FIREBASE_APP = "https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js";
const FIREBASE_AUTH = "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth-compat.js";

function firebaseConfig() {
  const apiKey = (process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "").trim();
  const authDomain = (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "").trim();
  const projectId = (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "").trim();
  const appId = (process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "").trim();
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    messagingSenderId: (process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "").trim() || undefined,
    storageBucket: (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "").trim() || undefined,
  };
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "1") resolve();
      else existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => {
      s.dataset.loaded = "1";
      resolve();
    };
    s.onerror = () => reject(new Error("Could not load Firebase."));
    document.head.appendChild(s);
  });
}

export function isFirebaseConfigured() {
  return !!firebaseConfig();
}

export async function getFirebaseAuth() {
  if (typeof window === "undefined") throw new Error("Firebase only runs in the browser.");
  const config = firebaseConfig();
  if (!config) throw new Error("Firebase phone env vars are not set. Add NEXT_PUBLIC_FIREBASE_* in Vercel and redeploy.");
  await loadScript(FIREBASE_APP);
  await loadScript(FIREBASE_AUTH);
  const firebase = window.firebase;
  if (!firebase) throw new Error("Firebase failed to initialize.");
  if (!firebase.apps.length) firebase.initializeApp(config);
  return firebase.auth();
}
