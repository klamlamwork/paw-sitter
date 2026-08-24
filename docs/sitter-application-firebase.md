# Sitter application + Firebase phone SMS

## 1. Supabase

Run `sql/83-sitter-applications.sql` in the Supabase SQL editor.

## 2. Firebase (Spark is fine)

1. Open [Firebase Console](https://console.firebase.google.com/) and create or select a project.
2. Add a **Web** app. Copy the firebaseConfig values.
3. Authentication → Sign-in method → enable **Phone**.
4. Authentication → Settings → Authorized domains: add `localhost` and `paw-sitter.vercel.app` (plus any custom domain).
5. Spark includes a monthly SMS quota. For local testing, add test phone numbers under Authentication → Sign-in method → Phone → Phone numbers for testing.

## 3. Vercel environment variables

Add these for Production (and Preview if you test there), then Redeploy:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

Optional: `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` and `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` (not required for phone OTP).

You already need `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (used to create the pending sitter row).
