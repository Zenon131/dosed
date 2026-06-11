# iOS App Store Release Plan — Dosed Tracker

## Overview

This document outlines the exact steps to build, submit, and release Dosed Tracker on the Apple App Store. It assumes you have an active Apple Developer Program membership ($99/year).

---

## Phase 1: Apple Developer Console Setup

### 1.1 Register Bundle Identifier

1. Go to [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. Click the **+** button and select **App IDs**
3. Choose **App** type
4. Enter the Bundle ID exactly as it appears in `app.json`:  
   `com.jonathanwallace.dosed`
5. **Enable these capabilities:**
   - ✅ Push Notifications
   - ✅ App Groups (if using shared storage / widgets — group ID: `group.com.jonathanwallace.dosed`)
6. Click **Continue** → **Register**

### 1.2 Create App Store Connect Record

1. Go to [App Store Connect → My Apps](https://appstoreconnect.apple.com/apps)
2. Click the **+** → **New App**
3. Select **iOS** platform
4. Fill in:
   - **Name:** `Dosed Tracker`
   - **Primary Language:** English
   - **Bundle ID:** `com.jonathanwallace.dosed` (select from dropdown)
   - **SKU:** `dosed-tracker-001` (internal identifier, anything unique)
   - **User Access:** Full Access
5. Click **Create**

> ⚠️ App names are globally unique in the App Store. If "Dosed Tracker" is taken, you’ll need a slight variation (e.g., "Dosed: Medication Tracker").

### 1.3 Set Up App Store Connect API Key (for EAS Submit)

1. In App Store Connect, go to **Users and Access → Integrations → App Store Connect API**
2. Click **+** to generate a new API key
3. Name it `EAS Submit Key`
4. Select **Admin** or **App Manager** role
5. Download the `.p8` private key file immediately (you can only download it once)
6. Note the **Issuer ID** and **Key ID** shown on the page

You’ll need these values later for `eas submit`.

---

## Phase 2: EAS Project Link

### 2.1 Initialize EAS Project

From the project root (`/Users/jonathanwallace/Projects/dosed`), run:

```bash
npx eas init
```

Follow the prompts:
- Log in to your Expo account (or create one)
- Select **Create a new project**
- Name it `dosed-tracker`

This will automatically add the `projectId` to `app.json` under `expo.extra.eas.projectId`.

### 2.2 Verify EAS Configuration

After initialization, confirm your `app.json` looks like this (only relevant fields shown):

```json
{
  "expo": {
    "name": "Dosed Tracker",
    "slug": "dosed-tracker",
    "version": "1.0.0",
    "ios": {
      "bundleIdentifier": "com.jonathanwallace.dosed",
      "supportsTablet": true,
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
    },
    "extra": {
      "eas": {
        "projectId": "your-generated-project-id"
      },
      "backendUrl": "https://jebz4aexzyy3xpvxwg7ypzmyzkq3g3wu.app.specular.dev"
    }
  }
}
```

And `eas.json`:

```json
{
  "cli": {
    "version": ">= 16.0.0",
    "appVersionSource": "local"
  },
  "build": {
    "production": {
      "autoIncrement": true,
      "channel": "production"
    }
  },
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "ascTeamId": "YOUR_TEAM_ID"
      }
    }
  }
}
```

---

## Phase 3: Credentials & Signing

### 3.1 Generate iOS Credentials via EAS

EAS can automatically manage your signing certificates and provisioning profiles:

```bash
npx eas credentials
```

Select:
- Platform: **iOS**
- Build profile: **production**

EAS will:
1. Generate a Distribution Certificate (or reuse an existing one)
2. Create a Provisioning Profile for `com.jonathanwallace.dosed`
3. Store them securely in Expo’s cloud

> 💡 If you already have certificates in your Apple Developer account, EAS can sync them. Choose **Use existing certificate** if prompted.

### 3.2 (Optional) Manual Certificate Management

If you prefer to manage certificates manually:
1. In Apple Developer → **Certificates**, create an **iOS Distribution** certificate
2. Download and install it in Keychain Access
3. In Apple Developer → **Profiles**, create an **App Store** provisioning profile for your Bundle ID
4. Download the `.mobileprovision` file
5. Run `npx eas credentials` and upload both files

---

## Phase 4: Final Configuration Checklist

Before building, verify every item below:

| Check | Status | Details |
|-------|--------|---------|
| Bundle ID registered | ⬜ | `com.jonathanwallace.dosed` in Apple Developer |
| App Store Connect record created | ⬜ | App appears in [App Store Connect](https://appstoreconnect.apple.com) |
| EAS project linked | ⬜ | `npx eas init` completed |
| Version number set | ✅ | `1.0.0` in `app.json` |
| Build number auto-increment | ✅ | `autoIncrement: true` in `eas.json` |
| App Groups capability (if using widgets) | ⬜ | `group.com.jonathanwallace.dosed` enabled in Apple Developer |
| Push Notifications capability | ⬜ | Enabled in Apple Developer |
| Export compliance | ✅ | `ITSAppUsesNonExemptEncryption: false` in `app.json` |
| Privacy policy URL ready | ✅ | See `store-assets/PRIVACY_POLICY.md` |
| App icon (1024×1024) | ✅ | `assets/images/app-icon-rtj.png` |
| Splash screen | ✅ | Same as icon ( acceptable for MVP) |
| Notification description | ✅ | `NSUserNotificationsUsageDescription` set in `app.json` |
| Backend URL confirmed | ⬜ | `extra.backendUrl` points to production backend |
| `eas.json` submit config filled | ⬜ | `ascAppId` and `ascTeamId` updated |

---

## Phase 5: Build Production IPA

### 5.1 Install Dependencies

```bash
npm install
```

### 5.2 Trigger Production Build

```bash
npx eas build --platform ios --profile production
```

**What happens next:**
1. EAS validates your configuration
2. Source code is uploaded to EAS build servers
3. iOS project is prebuilt (native code generated)
4. Credentials are applied (certificate + provisioning profile)
5. Xcode compiles the app into an `.ipa` archive
6. Build completes in ~10–20 minutes

You can monitor progress in the terminal or at [expo.dev](https://expo.dev).

### 5.3 Build Output

When finished, EAS provides:
- A download link for the `.ipa` file
- Build logs (useful if anything fails)
- QR code for OTA testing (not needed for App Store)

---

## Phase 6: Submit to App Store Connect

### Option A: EAS Submit (Recommended)

If you configured the App Store Connect API key:

```bash
npx eas submit --platform ios --profile production
```

EAS will:
1. Download the `.ipa` from the latest successful build
2. Authenticate with App Store Connect via API key
3. Upload the `.ipa` using Apple’s Transporter API
4. Return a submission confirmation

### Option B: Manual Upload via Transporter

1. Download the `.ipa` from EAS build output
2. Install [Apple Transporter](https://apps.apple.com/us/app/transporter/id1450874784) on your Mac
3. Drag the `.ipa` into Transporter
4. Click **Deliver**

---

## Phase 7: App Store Connect Configuration

After upload, the build appears in App Store Connect within 10–30 minutes.

### 7.1 Fill Store Listing

Navigate to your app → **App Store** tab → **App Information**:

| Field | Recommended Content |
|-------|-------------------|
| **Name** | Dosed Tracker |
| **Subtitle** | Never miss a dose again |
| **Category** | Health & Fitness (Primary) / Medical (Secondary) |
| **Description** | Dosed Tracker is a simple, beautiful medication reminder app. Add your prescriptions, set schedules, and get timely notifications so you never miss a dose. Features: • Smart reminders with personalized messages • Easy medication logging • Beautiful, clean interface • Local data storage for privacy |
| **Keywords** | medication, reminder, pill tracker, health, prescription, dose, med reminder, wellness |
| **Support URL** | [your website or email] |
| **Marketing URL** | (optional) |
| **Privacy Policy URL** | Host `store-assets/PRIVACY_POLICY.md` on your website or a privacy policy generator |

### 7.2 Upload Screenshots

Required sizes (see `store-assets/README.md` for full specs):

| Device | Resolution | Minimum Required |
|--------|-----------|------------------|
| iPhone 15 Pro Max / 16 Pro Max | 1290 × 2796 | ✅ Yes |
| iPhone 14 Plus / 13 Pro Max | 1284 × 2778 | (Apple scales from 6.7") |
| iPhone 8 Plus | 1242 × 2208 | Only if supporting 5.5" devices |
| iPad Pro 12.9" (6th gen) | 2048 × 2732 | Only if iPad is enabled |

**Tip:** Use iOS Simulator to capture clean screenshots:
```bash
# Example for iPhone 15 Pro Max
xcrun simctl boot "iPhone 15 Pro Max"
# Open Simulator, navigate to each screen, press Cmd+S to save screenshot
```

### 7.3 Set Pricing & Availability

- **Price:** Free (recommended for initial launch)
- **Availability:** All countries/regions or select markets
- **Content Rights:** None (if applicable)

### 7.4 App Review Information

| Field | Recommended Content |
|-------|---------------------|
| **Sign-in required?** | No |
| **Contact Information** | Your name, phone, email |
| **Review Notes** | "Dosed Tracker is a personal medication reminder and tracking tool. It does not provide medical advice, diagnosis, or treatment. All data is stored locally on the user's device. The app sends local push notifications at user-configured times. No account creation is required." |
| **Attachment** | (optional) Screen recording showing onboarding + adding a medication |

---

## Phase 8: Submit for Review

### 8.1 Create New Version

1. In App Store Connect, go to your app → **App Store** tab
2. Click **+** next to "iOS App" → **New Version**
3. Enter version number matching `app.json` (e.g., `1.0.0`)

### 8.2 Select Build

1. Scroll to **Build** section
2. Click **+** and select the build you just uploaded
3. Confirm it matches the version number

### 8.3 Final Checks

- [ ] All required screenshots uploaded
- [ ] Description, keywords, and URLs filled
- [ ] Privacy policy URL provided
- [ ] Build selected and associated
- [ ] Pricing set
- [ ] Review information complete

### 8.4 Submit

Click **Submit for Review** at the top right.

**Typical review times:**
- New apps: 24–72 hours
- Updates: 12–48 hours

---

## Phase 9: Post-Submission

### 9.1 Monitor Review Status

Check App Store Connect → **Activity** → **App Review** for updates. You’ll receive email notifications for:
- Status changes (In Review, Approved, Rejected)
- Rejection details (if any)

### 9.2 Common Rejection Reasons & Fixes

| Rejection | Cause | Fix |
|-----------|-------|-----|
| **Missing privacy policy** | No URL or broken link | Host your privacy policy and update URL in App Store Connect |
| **Medical claims** | Description implies medical authority | Revise description: "personal tracker/reminder only, not medical advice" |
| **Push notification permission** | App asks for permission too early | Only request after user adds first medication (already handled in your flow) |
| **Crashing on launch** | Build issue or missing native dependency | Check EAS build logs, test on physical device via TestFlight |
| **Incomplete metadata** | Missing screenshots for required device | Upload all required sizes |
| **Encryption compliance** | Missing export compliance | ✅ Already handled (`ITSAppUsesNonExemptEncryption: false`) |

### 9.3 Upon Approval

1. You’ll receive an email: **“Your app is ready for distribution”**
2. In App Store Connect, go to your app → **App Store** tab
3. Set **Release** to:
   - **Manually release this version** (you control exact timing)
   - **Automatically release** (goes live immediately)
   - **Schedule a release** (specific date/time)
4. Click **Release this Version** or wait for scheduled time

---

## Phase 10: Post-Launch Maintenance

### 10.1 TestFlight Beta Testing (Recommended)

Before your next major update:
1. Build with `preview` profile:  
   `npx eas build --platform ios --profile preview`
2. Upload to TestFlight
3. Invite internal testers (up to 100) or external testers (up to 10,000 via public link)
4. Gather feedback and crash reports

### 10.2 Analytics & Monitoring

- **App Store Connect Analytics:** Dashboard → **Analytics** tab
- **Crash Reports:** Xcode → **Window** → **Organizer** → **Crashes**
- **User Reviews:** Monitor ratings and reviews in App Store Connect

### 10.3 EAS Update (Optional)

For quick bug fixes without a full App Store review:
```bash
npx eas update --channel production --message "Fix notification scheduling bug"
```
> Note: EAS Update can only push JS/TS changes, not native code or asset changes.

---

## Quick Reference: One-Line Commands

| Task | Command |
|------|---------|
| Initialize EAS project | `npx eas init` |
| Manage iOS credentials | `npx eas credentials` |
| Production build | `npx eas build --platform ios --profile production` |
| Submit to App Store | `npx eas submit --platform ios --profile production` |
| Build + submit in one go | `npx eas build --platform ios --profile production --auto-submit` |
| Push OTA update | `npx eas update --channel production` |

---

## Next Steps (Your Immediate To-Do)

1. ⬜ Register `com.jonathanwallace.dosed` in Apple Developer
2. ⬜ Create App Store Connect app record
3. ⬜ Run `npx eas init` to link the project
4. ⬜ Generate App Store Connect API key (for EAS Submit)
5. ⬜ Update `eas.json` with `ascAppId` and `ascTeamId`
6. ⬜ Host the privacy policy online and copy the URL
7. ⬜ Capture screenshots in Simulator
8. ⬜ Run `npx eas build --platform ios --profile production --auto-submit`
