# Dosed Tracker — App Store Release Checklist

## 1. Pre-Flight Configuration

- [ ] **Link to EAS project**  
  Run `npx eas init` from the project root. This adds `extra.eas.projectId` to `app.json`.

- [ ] **Verify bundle IDs / package names**
  - iOS: `com.jonathanwallace.dosed`
  - Android: `com.jonathanwallace.dosed`
  Ensure these match what you registered in Apple Developer & Google Play Console.

- [ ] **Confirm backend URL**  
  Check `app.json` → `extra.backendUrl`. If the Specular preview URL is not your permanent production backend, update it before building.

- [ ] **Update app version**  
  `version` in `app.json` is set to `1.0.0`. Update it if this is a new version.  
  `autoIncrement` in `eas.json` handles `buildNumber` (iOS) and `versionCode` (Android) automatically.

- [ ] **Remove dev-only code**
  `__DEV__` checks are fine, but strip any hardcoded test data, mock APIs, or debug UI before release.

---

## 2. Apple App Store Specifics

### Capabilities & Entitlements
- [ ] **Push Notifications** — Enabled in Apple Developer & provisioning profile.
- [ ] **App Groups** — `group.com.jonathanwallace.dosed` must be registered in your Apple Developer account if you use `@bacons/apple-targets` / shared storage.
- [ ] **Export Compliance** — `ITSAppUsesNonExemptEncryption: false` is already set in `app.json`, which skips the export-compliance questionnaire on upload.

### App Store Connect Metadata
- [ ] App name: **Dosed Tracker**
- [ ] Subtitle (30 chars max)
- [ ] Description
- [ ] Keywords
- [ ] Support URL
- [ ] Marketing URL (optional)
- [ ] **Privacy Policy URL** *(required)* — especially critical for a health/medication app.
- [ ] Primary category: **Medical** or **Health & Fitness**
- [ ] Age rating
- [ ] Pricing & availability
- [ ] Screenshots for required device sizes (see `store-assets/README.md`)

### Apple Review Notes
Because this is a health-adjacent app:
- Do **not** make medical claims (e.g., “guarantees adherence”). Frame it as a **personal tracker/reminder**.
- Mention in Review Notes: “App provides local reminders only and does not diagnose, treat, or replace professional medical advice.”

---

## 3. Google Play Specifics

- [ ] Create app in Google Play Console with package `com.jonathanwallace.dosed`
- [ ] Generate a **Google Cloud service account** with `Release Manager` role and download the JSON key.
- [ ] Fill in `eas.json` → `submit.production.android.serviceAccountKeyPath` with the path to that JSON key.
- [ ] App signing: either let Google manage your signing key or upload an existing one.
- [ ] Content rating (ICSA) questionnaire
- [ ] Data safety form (disclose health data collection if any)
- [ ] **Privacy policy URL** *(required)*
- [ ] Store listing: description, short description, screenshots, feature graphic

---

## 4. Asset Quality Audit

| Asset | Current Status | Recommendation |
|---|---|---|
| **App Icon** | `app-icon-rtj.png` (1024×1024) | ✅ Good size. Make sure it has no alpha/transparency for iOS. |
| **Splash Screen** | Same file as icon | ⚠️ OK for MVP. Ideally use a splash-specific design. |
| **Android Adaptive Icon** | Same file as icon | ⚠️ The foreground should have transparent areas so the background color (`#FFFFFF`) shows through. If the whole image is opaque, it won’t look adaptive. |
| **Android Notification Icon** | Same file as icon | 🔴 **Needs fix.** Android notification icons must be a small white-with-transparency image. Full-color PNGs render as a solid grey blob. Create `assets/images/notification-icon.png` (96×96, white shape on transparent bg) and update the `expo-notifications` plugin config in `app.json`. |

---

## 5. Build & Submit

### Step 1: Install dependencies
```bash
npm install
# or
bun install
```

### Step 2: Configure EAS credentials (one-time)
```bash
npx eas build:configure
```

### Step 3: Production build — iOS
```bash
npx eas build --platform ios --profile production
```
This produces an `.ipa` ready for App Store Connect.

### Step 4: Production build — Android
```bash
npx eas build --platform android --profile production
```
This produces an `.aab` (Android App Bundle) for Google Play.

### Step 5: Submit (optional — EAS Submit)
Once builds complete, you can submit directly:
```bash
npx eas submit --platform ios --profile production
npx eas submit --platform android --profile production
```
Or manually upload the artifacts to App Store Connect and Google Play Console.

---

## 6. Post-Submission

- [ ] Turn on **Crashlytics / Sentry** (or any error-tracking) in production.
- [ ] Enable **EAS Update** if you want OTA patch capability later.
- [ ] Set up **App Store / Play Store analytics** to monitor crashes and reviews.
- [ ] Respond quickly to rejection feedback (average turnaround is 24–48 hours for Apple, a few hours for Google).

---

## Known Issues / Quick Fixes Applied

| File | Change |
|---|---|
| `package.json` | Removed bogus `"eas": "^0.1.0"` dep; added `eas-cli` as devDependency. |
| `eas.json` | Added `cli.version`, `build.production.channel`, and `submit.production` skeleton. |
