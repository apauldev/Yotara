# Plan: Startup wizard for new accounts

**Date:** 2026-11-09  
**Status:** Proposed  
**Related:**
- `docs/plans/2026-11-04-comprehensive-ux-review.md` — onboarding findings and the "speedbump" critique
- `docs/archive/setup-install-experience.md` — historical first-run setup exploration (never shipped)
- `apps/frontend/src/app/core/services/preferences-store.service.ts`
- `apps/frontend/src/app/core/services/theme.service.ts`

## 1. Goal

Replace the single-button `/onboarding` screen with a calm, six-step startup wizard that runs
whenever a new account first signs in. The wizard lets the person:

1. understand what Yotara is for, confirm the account identity, and optionally add a profile photo,
2. choose one of the nine themes with a live preview,
3. configure the settings that already exist on the Settings page,
4. choose which starter projects and labels to create, add their own, or start empty,
5. read three tips that are true of the shipped product, and
6. finish with a summary and an optional first task.

The wizard owns onboarding for every new account, regardless of whether signup used the
frictionless password flow or the email-first verification flow. Existing accounts are untouched.

## 2. What exists today

### 2.1 Trigger and current flow

Both signup paths already converge on `/onboarding`:

- Frictionless signup redirects with `?created=1` from `login.component.ts` after `signUp()`.
- Email-first signup verifies the email, sets a password, then navigates to `/onboarding` from
  `verify-email.component.ts`.

The route is guarded by `authGuard` + `onboardingGuard` (`apps/frontend/src/app/app.routes.ts:12-19`).
`onboardingGuard` redirects to `/onboarding` whenever `authState.needsOnboarding()` is true and
away from it once `user.onboardingCompleted` is true. It already treats any URL starting with
`/onboarding` as part of the flow, so sub-paths would not need a guard change
(`apps/frontend/src/app/core/guards/onboarding.guard.ts:19-26`).

The current `StartScreenComponent` is a welcome card with one **Continue** button. The workspace
picker is commented out and `continue()` hard-codes personal mode
(`apps/frontend/src/app/features/onboarding/pages/start-screen/start-screen.component.ts:60-69`).
The progress dots are also commented out
(`start-screen.component.html:74-78`). `preview/picker` loads the same component unguarded and is
dead code (`app.routes.ts:20-25`).

### 2.2 Completion and starter content

`AuthStateService.completeOnboarding('personal')` sends `PATCH /me` with
`{ workspaceMode, onboardingCompleted: true }`. On the false-to-true transition only, the server
seeds seven starter projects and six starter labels for personal workspaces
(`apps/api/src/routes/me.ts:153-166`; seeders in `services/project-service.ts` and
`services/label-service.ts`). Seeding is idempotent and retry-safe because it runs before the
completion marker is persisted.

The default suite is currently server-private:

- Seven projects: Work, Personal, Home, Health, Finance, Learning, Side Projects, each with a
  description and color (`DEFAULT_PROJECTS` in `apps/api/src/services/project-service.ts`).
- Six labels: Urgent, Waiting, Errands, Review, Someday, Focus, each with a color and icon
  (`DEFAULT_LABELS` in `packages/shared/src/default-labels.ts`).

There is no way to choose a subset or add custom starter items today. A project deletion or
retirement route does not exist yet, although `projects.retiredAt` is already in the schema
(`apps/api/src/db/schema.ts`). Labels can already be deleted and merged.

`PATCH /me` already accepts `archiveAutoDelete` and `captureBehavior` alongside the completion
flags (`apps/api/src/routes/me.ts:110-121`, OpenAPI `UpdateProfile` at
`apps/api/src/docs/openapi.ts:452-465`). The wizard can save every server-owned choice in one
request once the starter-content field is added.

`ProjectService` and `LabelService` deliberately return an empty list until
`onboardingCompleted` is true, so the wizard must not expect starter data mid-flow.

### 2.3 Settings, themes, and tips inventory

The Settings page exposes these controls across three sections
(`apps/frontend/src/app/features/personal/pages/settings-page.component.ts:37-179`):

**Appearance**

| Label in Settings | Signal | localStorage key | Default |
|:---|:---|:---|:---|
| Application theme | `themeService.theme()` | `yotara-theme` | `light-forest` |
| Show label names in task lists | `showLabelNames` | `yotara_showLabelNames` | `true` |
| Color-first labels | `colorFirstLabels` | `yotara_colorFirstLabels` | `false` |

**Behavior**

| Label in Settings | Signal / field | Storage | Default |
|:---|:---|:---|:---|
| Auto-clear completed tasks | `archiveAutoDelete` | API user field | `true` |
| Capture behavior | `captureBehavior` | API user field | `'quick'` |
| Complete task confirmation | `skipCompleteConfirm` | localStorage | `false` (confirmation on) |
| Task completion notifications | `actionNotifications` | localStorage | `true` |
| Daily insights | `insightDismissed` | localStorage | `false` (insights on) |
| Show login tips | `loginTipDismissed` | localStorage | `false` (tips on) |
| Desktop notifications | `desktopNotifications` | localStorage | `false` |

**Account (current):** email and verification badge, change password, logout, delete account.
The commented-out "Profile settings" row is not rendered; this plan adds a Profile photo row there.

Other internal localStorage keys exist (calendar display toggles, label-directory sort, local
mirrors of onboarding state). They are not in Settings and are intentionally not part of the
wizard.

Server-owned user fields (`apps/api/src/db/schema.ts:13-30`):

| Field | Default | Notes |
|:---|:---|:---|
| `workspaceMode` | `null` | Set to `personal` by the wizard |
| `onboardingCompleted` | `false` | Set at the end of the wizard |
| `archiveAutoDelete` | `true` | Auto-clear completed tasks after 30 days |
| `captureBehavior` | `'quick'` | `quick` or `capture` (open the task modal) |
| `image` | `null` | Optional profile photo as a data URL; exposed by `PublicUser` but not rendered today |

The Settings "Profile settings" row (name, email, avatar) is commented out, and no component
renders `user.image`. This plan adds a dedicated **Profile photo** control to Settings and the
wizard (see §4.9).

The nine themes are declared as CSS classes in `apps/frontend/src/styles.css` and driven by
`ThemeService`, which persists `yotara-theme` and toggles `dark` and `color-scheme`
(`apps/frontend/src/app/core/services/theme.service.ts`). The theme id list is duplicated three
times inside the service, and display names live only as literal `<option>` text in the settings
template (`settings-page.component.ts:50-58`). There is no shared theme catalogue.

Tips are a module-private `TIPS` array in the personal shell
(`apps/frontend/src/app/features/personal/shell/personal-shell.component.ts:55-85`). One tip is
chosen uniformly at random on every shell construction (`:190-192`) and shown in a blocking modal.
The array still contains tips for features that do not exist (a `?` shortcut sheet, batch actions,
drag-to-reorder in lists), per the UX review.

The completion-confirmation row is inverted: the checkbox label says confirmation happens when
disabled, while checking it sets `skipCompleteConfirm = true`
(`settings-page.component.ts:125-136`).

## 3. Product decisions

1. **Use the existing guarded route, not a modal.** Keep `/onboarding` as the entry point and
   replace `StartScreenComponent` with a `StartupWizardComponent`. A route works identically for
   both signup variants, survives a refresh, and prevents the app shell from flashing behind an
   overlay. Do not add child routes; keep the step in component state and mirror it to `?step=`.
2. **One wizard, six steps.** Welcome → Look & feel → Workflow & notifications → Starter projects
   & labels → Tips → Ready. The flow should read in about a minute and must not ask for the
   account name, email, or password again.
3. **Personal mode only.** Team mode remains deferred. Do not restore the commented-out
   workspace picker. The wizard states that Yotara is personal-first today.
4. **Themes preview live and are the centerpiece of step two.** Clicking a theme card applies it
   immediately through `ThemeService`. Show the nine themes as a radio group with visible names,
   a light/dark tag, and a four-swatch preview (background, surface, primary, accent). Never rely
   on color alone to indicate selection.
5. **Expose only controls that exist on the Settings page.** The wizard must not invent
   preferences or surface internal keys. Its configurable controls are the ten preference rows in
   §2.3 plus the Profile photo control this plan adds, using the same labels and semantics. Tips,
   theme choice, and starter content are the only wizard-specific surfaces.
6. **Fix the inverted confirmation wording in the wizard.** Present **Ask before completing
   tasks** (checked means `skipCompleteConfirm = false`), default off, matching the UX review's
   recommendation. Leave the existing Settings row's behavior alone in this plan; correcting its
   label is a separate small fix.
7. **Tips are curated, not random.** The tips step shows three known-good tips with concrete
   examples: inline capture syntax, Today/Upcoming, and calendar drag-to-reschedule. Extract the
   tip catalogue so the shell and wizard share one source of truth, and remove tips that describe
   unshipped features.
8. **Suppress the shell's duplicate first-run tip.** On completion, mark the login tip dismissed
   for the session only (`setLoginTipDismissed(true, false)`), so the shell does not immediately
   open another blocking tip modal after a wizard that just showed tips. The Setting continues to
   govern later sessions.
9. **The wizard is skippable at any point.** A **Skip setup** action applies current/default
   choices and completes onboarding. A first-run flow must never trap the person.
10. **Persist progress locally.** Save the draft under a user-scoped key with a 24-hour expiry so
    a refresh, accidental close, or second tab resumes where it left off. Clear the draft after a
    successful completion.
11. **Complete once, atomically.** Send a single `PATCH /me` containing workspace mode, completion
    flag, `archiveAutoDelete`, `captureBehavior`, the selected starter content, and the optional
    profile photo. Do not write server state on earlier steps. If it fails, stay on the Ready step
    with a retry; the guard keeps the person inside the flow.
12. **Starter content is selectable, not implicit.** The default suite is preselected, each item
    can be deselected, custom projects and labels can be added, and **Start empty** clears
    everything. Seed exactly what the person confirms. This replaces the old "always seed seven
    projects and six labels" behavior for the wizard path while keeping the server default for
    clients that omit the field.
13. **No telemetry, and only optional personal data.** The wizard records preferences and starter
    content that already exist as concepts, plus an optional profile photo the person explicitly
    adds. Yotara has no analytics; do not add any.
14. **Local appearance preferences remain browser-local in this iteration.** The wizard writes
    them to localStorage. Cross-device theme persistence is a worthwhile follow-up but is not a
    prerequisite for shipping the wizard (see §7).
15. **Project deletion is a planned follow-up.** The schema already carries `projects.retiredAt`,
    but no delete or retire route exists. Until that ships, the starter step says the defaults can
    be renamed later. When project deletion lands, update that copy to "rename or remove" and link
    the two efforts in the release note.
16. **The profile photo is optional and processed entirely in the browser.** Use
    `ngx-image-cropper` to crop square, resize to 256×256, and emit a WebP/JPEG/PNG data URL.
    Initials remain the default. The original file never leaves the browser; only the processed
    data URL is sent to the person's own Yotara API and stored in `user.image`.
17. **Limits and formats.** Accept JPEG, PNG, and WebP up to 5 MB. Reject SVG (script risk), GIF
    (animation), and HEIC (inconsistent browser support). Target ≤ 64 KB of encoded output and
    reject anything over 128 KB decoded on the server. Store it as text: no multipart endpoint, no
    server-side image library, no remote avatar service. GitHub caps profile photos at 1 MB; 5 MB
    is more forgiving for phone photos and still safe because the browser does the resize.

## 4. Wizard flow

### 4.1 Shell and navigation

- Full-screen layout modelled on `.onboarding-screen` in `start-screen.component.css`:
  `min-height: 100dvh`, `var(--surface)` background, brand header, centered content column.
- Header: Yotara mark and name, **Not you? Sign out**, and a quiet **Skip setup** text button.
  Signing out calls `authState.signOut()` and returns to `/login`; without it, a person who created
  the wrong account or is on a shared device has no escape from the guarded flow.
- Footer: **Back** (hidden on step one), step indicator, and **Continue** / **Enter Yotara**.
  The primary button is disabled while the completion request is in flight and shows
  `Saving...`.
- Step indicator: an ordered list of six dots with visually hidden labels, `aria-current="step"`
  on the active dot, and a polite live region announcing `Step 2 of 6: Look and feel`.
- Focus moves to the step heading after every transition. The step body is a single `<main>` with
  an `aria-labelledby` pointing at the heading.
- Animations are limited to a 120–160 ms opacity/translate transition and are disabled under
  `prefers-reduced-motion: reduce`. No routing-level animation infrastructure is added.
- Mobile: one column, card grid collapses to two columns (themes) or one (everything else),
  footer actions become full-width, and spacing respects safe-area insets.

### 4.2 Step 1 — Welcome

Copy skeleton:

```text
Welcome, {first name}
A calm place for what matters today.
Yotara keeps capture, planning, and finishing in one quiet workspace.
This takes about a minute. Everything can be changed later in Settings.
[Continue]                         Skip setup
```

- Use `authState.user()?.name` for the greeting; fall back to "Welcome to Yotara".
- Show the shared avatar beside the signed-in email ("Signed in as {email}") so the person can
  confirm the account before configuring it. Offer an optional **Add a photo** action; initials
  remain the default. The header sign-out action covers the wrong-account case. See §4.9.
- Keep the `?created=1` acknowledgment as a small success note, not a separate screen.
- Mention the four things the wizard will set up: how it looks (including an optional photo), how it
  behaves, starter content, and a few tips.

### 4.3 Step 2 — Look & feel

**Theme picker**

- Nine cards rendered from the shared theme catalogue, each with name, light/dark tag, and a
  preview strip. Apply each card's `theme-<id>` class to the card itself so its swatches resolve
  from that theme's tokens while the rest of the page keeps the active theme. Cards are native
  radio inputs inside labels so keyboard and screen-reader behavior is free.
- Selecting a card calls `themeService.setTheme(id)` immediately; the whole wizard re-themes live.
- Group visually into light and dark sets, or keep one ordered grid with tone tags. The default is
  Light Forest.

**Label display** (secondary section under the theme grid)

- **Show label names in task lists** — maps to `showLabelNames` (default on).
- **Color-first labels** — maps to `colorFirstLabels` (default off). Present as a compact
  secondary toggle; it is a refinement, not a first-run decision.

The copy explains that themes affect every screen and that the label choice is reversible.

### 4.4 Step 3 — Workflow & notifications

Two grouped sections in one scrollable step. Every control here mirrors a Settings row; no new
preferences are introduced.

**How tasks behave**

| Control (Settings label) | Meaning | Default |
|:---|:---|:---|
| Capture behavior | Quick capture from the bar vs. open the full task modal | Quick capture |
| Auto-clear completed tasks | Keep completed tasks for 30 days vs. keep indefinitely | On |
| Ask before completing tasks | Show a confirmation dialog on checkbox completion | Off |

**Notifications & prompts**

| Control (Settings label) | Meaning | Default |
|:---|:---|:---|
| Task completion notifications | In-app toast when a task completes | On |
| Desktop notifications | Browser notifications for due tasks | Off |
| Daily insights | Daily Clarity / Yotara Journal prompt in the task header | On |
| Show login tips | A short tip after sign-in | On |

- Desktop notifications request permission from the toggle click (a user gesture). If the
  browser denies permission, show the same "Blocked — enable in browser settings" state the
  settings page uses and store the value as off.
- Each row uses the `settings-item` / `toggle-input` / `settings-select` visual language from
  `settings-page.component.ts`, scoped to the wizard, so the wizard and Settings feel related.
- Add one line of plain-language help per row. Do not explain implementation details.

### 4.5 Step 4 — Starter projects & labels

This step decides what exists on the first day. It is content selection, not a new preference.

**Data source**

- Projects and labels are shown from a shared default catalogue, not fetched: `ProjectService` and
  `LabelService` return empty until onboarding completes.
- Move `DEFAULT_PROJECTS` from `apps/api/src/services/project-service.ts` into
  `packages/shared/src/default-projects.ts` (matching `default-labels.ts`) and export both
  catalogues from `packages/shared/src/index.ts`. The wizard and the seeder then agree on names,
  descriptions, colors, and icons.
- Persist only selection state and custom names in the draft; rehydrate default descriptions,
  colors, and icons from the shared catalogue on load. A 24-hour-old draft must not seed metadata
  that a release has since changed.

**Projects panel**

- All seven defaults are listed and checked.
- Each row: checkbox, name, short description, color dot.
- **Add project** input appends a selected custom project. Custom projects get a name and a
  server-assigned color; no color picker in the wizard.
- Custom rows have a remove action. Default rows cannot be renamed here; they can be deselected.
- No nested or hidden behavior. Deselecting removes the item from the payload.

**Labels panel**

- All six defaults are listed and checked.
- Each row: checkbox, label icon, name, and color chip.
- **Add label** input appends a selected custom label. The server assigns a color from the existing
  label palette and the default icon; no icon/color picker in the wizard.
- Custom rows have a remove action.

**Quick actions**

- **Use default suite** — checks all defaults and clears custom additions.
- **Start empty** — unchecks everything and clears custom additions.

**Summary and validation**

- Live count: `5 projects · 4 labels will be created`.
- Names are trimmed, required, and deduplicated case-insensitively against every row in that list,
  including deselected defaults. Duplicate or empty additions show an inline error and are not
  appended.
- The copy says the defaults can be renamed later. Labels can already be merged or deleted;
  projects cannot be removed until the deletion follow-up ships, so do not promise project
  removal.

### 4.6 Step 5 — Three tips to start

Show three cards, each with an icon, a short statement, and a worked example:

```text
Capture in plain language
Finish quarterly review #work @Roadmap !high tomorrow 3pm

Keep the next step visible
Today shows what is due or marked for today; Upcoming plans the week ahead.

Move a task by dragging
On desktop, drag a task to another day in Calendar, or double-click a day to create one.
```

- Source these from the shared tip catalogue. Before using a tip, verify the feature exists; the
  UX review found several ghost tips.
- Add an **Open Settings later** note: "You can revisit all of this in Settings."
- Do not make any tip interactive in this iteration.

### 4.7 Step 6 — Ready

- Summary list of the chosen avatar, theme, capture behavior, notifications, insights, and starter
  content, each with an **Edit** link that jumps back to the relevant step.
- Starter-content summary: `{n} projects and {m} labels will be created`, with the selected names
  as chips. When nothing is selected, say "You will start with an empty workspace."
- Optional **What do you want to finish today?** text input (single line, 200-character cap).
  If filled, create one inbox task after onboarding completes and before navigating away. This
  field creates a plain title; do not advertise `#`, `@`, or `!` capture syntax there unless it
  reuses the capture parser.
- Primary action: **Enter Yotara**.
- On success, navigate with `authState.getPostAuthRedirectUrl()` (lands on `/inbox`, which
  redirects to `/tasks?view=inbox`).

### 4.8 Back, skip, and resume

- **Back** never loses choices. The theme may already be applied to the browser; that is
  acceptable because it is the person's own session and the theme was explicitly chosen.
- **Skip setup** completes with the draft's current values, including any photo already chosen, and
  navigates away. The draft starts from real defaults, so skipping creates the default suite. Show
  no confirmation dialog; skipping is reversible in Settings and Projects/Labels.
- Draft shape:

  ```ts
  interface StarterProjectDraft {
    name: string;
    description?: string;
    color?: ProjectColor;
    selected: boolean;
    isDefault: boolean;
  }

  interface StarterLabelDraft {
    name: string;
    color?: string;
    icon?: LabelIcon;
    selected: boolean;
    isDefault: boolean;
  }

  interface WizardDraft {
    step: 'welcome' | 'look' | 'defaults' | 'starter' | 'tips' | 'ready';
    theme: Theme;
    showLabelNames: boolean;
    colorFirstLabels: boolean;
    captureBehavior: 'quick' | 'capture';
    archiveAutoDelete: boolean;
    askBeforeComplete: boolean;
    actionNotifications: boolean;
    desktopNotifications: boolean;
    dailyInsights: boolean;
    showLoginTips: boolean;
    avatarDataUrl: string | null;
    avatarTouched: boolean;
    starterProjects: StarterProjectDraft[];
    starterLabels: StarterLabelDraft[];
    firstTaskTitle: string;
  }
  ```

- Persist to `localStorage['yotara_wizard_draft:<userId>']` as `{ savedAt, draft }`. Ignore and
  delete entries older than 24 hours or belonging to another user. Clear on completion.
- The `?step=` query param mirrors the draft step for deep links and refresh. Validate it against
  the six known ids; fall back to `welcome`. Update it with `replaceUrl: true` so the browser Back
  button does not replay every step, and subscribe to `queryParamMap` so pasted links, refresh, and
  Forward land on the right step. The in-wizard **Back** button is the step-navigation control.

### 4.9 Identity and profile photo

- **Initials are the default; a photo is optional.** A new account renders a shared `app-avatar`
  with initials until the person adds a photo. Do not add a separate wizard step; the photo action
  lives on the Welcome step and in Settings.
- Extract the duplicated initials logic into one `getInitials()` helper. The shells currently use
  different fallbacks (`PS` and `YT`), and neither renders `user.image`.
- Initials rules: first letters of the first two words; a single word uses its first letter; an
  empty name falls back to the email's first letter, then `Y`. Use `Array.from` or segmentation for
  non-Latin names.
- Visual: theme-aware `--primary-soft` background with `--primary-solid` initials. When a photo is
  present, render it with `object-fit: cover` and the same circular/rounded mask.
- **Crop and resize in the browser.** Use `ngx-image-cropper` (MIT, peer dependencies
  `@angular/common` and `@angular/core >= 17.3.0`) to crop square and resize to 256×256 at WebP
  quality 82. It handles zoom, touch, EXIF orientation, keyboard movement, and accessible labels,
  so no custom canvas or crop math is written. 256×256 covers 3× displays for the 40–44 px shell
  avatars and leaves headroom for the Settings preview while staying only tens of kilobytes.
- Normalize the cropper result to a full data URL. If the library returns a bare base64 string,
  prepend the matching `data:image/...;base64,` prefix. If WebP is unavailable and the browser
  emits PNG or JPEG instead, accept the actual MIME; the server allows all three. If a browser
  cannot decode a WebP input at all, show a clear "choose a JPEG or PNG" message.
- The processed output is a data URL (`data:image/webp;base64,...`) stored in the existing
  `user.image` text column. No schema change, no multipart endpoint, no server-side image library,
  and no third-party avatar service. The original file never leaves the browser; only the
  processed data URL is sent to the person's own Yotara API.
- Limits: accept JPEG, PNG, and WebP up to 5 MB. Reject SVG (script risk), GIF (animation), and
  HEIC (inconsistent browser support) with a clear message. Target ≤ 64 KB of encoded output; the
  server rejects anything over 128 KB decoded. If 1 MB is preferred, use it, but it rejects many
  phone photos.
- Show the avatar on Welcome and Ready, with **Add photo**, **Change**, and **Remove**. The wizard
  keeps the result in the draft and sends it once in the completion PATCH. Settings gets the same
  editor and calls `PATCH /me { image }`; removal sends `image: null`.
- Do not use Gravatar or any remote avatar service: it leaks an email hash to a third party.
- Generated nature-icon avatars remain a follow-up; the archived setup plan has a 32-icon design.
- The production CSP already allows `img-src 'self' data:`, so data-URL avatars render without a
  header change. Keep that directive when self-hosters override `CONTENT_SECURITY_POLICY`.

## 5. Settings included in the wizard

Every row below is a Settings control. The ten preference rows already exist; **Profile photo** is
added to Settings by this plan and reused in the wizard. No internal keys, calendar-only toggles,
or unimplemented settings are exposed.

| Setting (exact Settings label) | Key / field | Default | Storage | Wizard step |
|:---|:---|:---|:---|:---|
| Application theme | `yotara-theme` | `light-forest` | localStorage | Look & feel |
| Show label names in task lists | `showLabelNames` | `true` | localStorage | Look & feel |
| Color-first labels | `colorFirstLabels` | `false` | localStorage | Look & feel |
| Capture behavior | `captureBehavior` | `quick` | API user field | Workflow |
| Auto-clear completed tasks | `archiveAutoDelete` | `true` | API user field | Workflow |
| Complete task confirmation | `skipCompleteConfirm` | `false` | localStorage | Workflow |
| Task completion notifications | `actionNotifications` | `true` | localStorage | Workflow |
| Desktop notifications | `desktopNotifications` | `false` | localStorage | Workflow |
| Daily insights | `insightDismissed` | `false` | localStorage | Workflow |
| Show login tips | `loginTipDismissed` | `false` | localStorage | Workflow |
| Profile photo (new in this plan) | `user.image` | `null` (initials) | API user field | Welcome |

The Profile photo row is an account control, not a preference. It opens the shared avatar editor
and supports **Add photo**, **Change**, and **Remove**; removal stores `null` and falls back to
initials.

The wizard presents **Complete task confirmation** as **Ask before completing tasks** to correct
the inverted wording; the stored value and Settings behavior are unchanged.

Starter projects and labels are content, not settings. Their catalogue and seeding contract are
described in §4.5 and §6.2.

Deliberately absent because they are not Settings controls:

- Display-name, email, or other profile edits. Only the avatar is added; name and email remain
  read-only, and `PATCH /me` does not accept `name`.
- Email-verification status or resend actions. The Account section displays the badge only.
- A "match system" theme option. `ThemeService` supports nine fixed themes; there is no system
  mode in Settings.
- Default view, week start, date format, and sort order. None are implemented.
- Import, two-factor authentication, and email digests.
- Avatar upload to a file store, generated nature icons, or remote avatar services (Gravatar).
  The photo is a client-processed data URL stored in `user.image`.
- Timezone selection. The app deliberately uses the browser zone.

## 6. Persistence and completion

### 6.1 Client changes

Extend the completion call so one request carries every server-owned choice:

```ts
// packages/shared/src/auth.ts
export interface StarterProjectInput {
  name: string;
  description?: string;
  color?: ProjectColor;
}

export interface StarterLabelInput {
  name: string;
  color?: string;
  icon?: LabelIcon;
}

export interface StarterContent {
  projects: StarterProjectInput[];
  labels: StarterLabelInput[];
}

export interface OnboardingPreferences {
  archiveAutoDelete?: boolean;
  captureBehavior?: CaptureBehavior;
  starterContent?: StarterContent;
  image?: string | null;
}

completeOnboarding: async (
  workspaceMode: WorkspaceMode,
  preferences: OnboardingPreferences = {},
) =>
  request<ProfileResponse>('/me', {
    method: 'PATCH',
    body: JSON.stringify({
      workspaceMode,
      onboardingCompleted: true,
      ...preferences,
    }),
  });
```

`AuthStateService.completeOnboarding()` forwards the same options and continues to set
`userState` from the response. `archiveAutoDelete` and `captureBehavior` already work; the starter
content and image fields are new.

`AuthService.updateProfile()` and `AuthStateService.updateProfile()` also gain
`image?: string | null` so the Settings Profile photo row can add, replace, or remove a photo
without completing onboarding.

### 6.2 Server changes

**Route**

Extend the `PATCH /me` body type and OpenAPI `UpdateProfile` schema with:

```ts
starterContent?: {
  projects: Array<{ name: string; description?: string; color?: ProjectColor }>;
  labels: Array<{ name: string; color?: string; icon?: LabelIcon }>;
};
image?: string | null;
```

`UpdateProfile` uses `additionalProperties: false`, so the schema must be updated before the
client sends the field, or the request is rejected.

**Seeding behavior**

Inside the existing `onboardingJustCompleted && nextWorkspaceMode === 'personal'` branch:

- If `starterContent` is omitted, keep today's behavior: seed the full default suite.
- If `starterContent` is provided, seed exactly the selected projects and labels.
- Empty arrays mean "seed nothing".
- Ignore `starterContent` when onboarding is already complete or the workspace is not personal.
  Do not fail the request; the rest of the profile patch still applies.

**Seed functions**

- `seedDefaultProjectsForOwner(ownerId, projects?)` accepts the list to insert, defaulting to
  `DEFAULT_PROJECTS` for backward compatibility.
- `seedDefaultLabelsForOwner(ownerId, labels?)` accepts the list to insert, defaulting to
  `DEFAULT_LABELS`.
- Keep both idempotent. Projects skip names that already exist. For labels, drop the current
  "return early if the user has any labels" guard inside the seeder and rely on
  `onConflictDoNothing()` for the `(user_id, name_norm)` index. The seeder only runs on the
  transition, so this cannot resurrect deleted defaults, and it lets a retry after a partial
  failure insert a changed selection.
- Custom labels without a color use `pickLabelColor(name)`; without an icon use
  `DEFAULT_LABEL_ICON`. Custom projects without a color store `null`.
- Keep the seeders before the completion update so a failure leaves onboarding incomplete and
  retryable. Preferably wrap both seeders and the `users` update in one transaction so a failure
  leaves no partial content. If that is not feasible, document the additive-retry caveat: items
  seeded before the failure cannot be removed during retry because project deletion does not exist
  yet.

**Validation**

Add a small `apps/api/src/lib/starter-content.ts` validator used by the route:

- Maximum 50 projects and 50 labels per request.
- Names trimmed; 1–80 characters for projects and labels; descriptions at most 200 characters.
- Reject empty names with a 400 `BadRequestError`.
- Deduplicate case-insensitively within each list (`labelNameKey` for labels); reject duplicates
  with a clear message rather than silently merging.
- Validate project colors against the `ProjectColor` enum, label colors with the existing hex
  pattern, and label icons with `isLabelIcon()`.
- Do not allow `workspaceMode: 'team'` with starter content; team seeding remains out of scope.

The route already exports the seeders and the normalizers are reusable
(`normalizeHexColor`, `normalizeLabelIcon`, `labelNameKey`). Keep validation in one place so the
wizard and any future client cannot insert malformed starter content.

**Avatar validation**

Add `apps/api/src/lib/avatar.ts` (or extend the starter-content validator) to accept `image` as
`null` or a data URL matching `data:image/(png|jpeg|webp);base64,<base64>`:

- Reject remote URLs, `data:image/svg+xml`, GIF, and any non-image MIME. SVG is not allowed because
  it can carry script.
- Decode the base64 and check magic bytes (PNG, JPEG, WebP) so a spoofed MIME cannot be stored.
- Cap the decoded image at 128 KB (about 200,000 characters of data URL). A 256×256 WebP is
  typically 10–25 KB.
- Store the exact data URL in `users.image`; `null` clears it. No multipart route and no server-side
  image library are needed.
- Update OpenAPI `AppUser.image` from `format: 'uri'` to a plain nullable string with a 200,000
  character cap, and add `image` to `UpdateProfile`. `PATCH /me` uses Fastify's 1 MB body limit, so
  the avatar string fits comfortably.

### 6.3 Completion sequence

1. Ensure the draft is valid; require nothing except the defaults (every choice has one).
2. Build `starterContent` from the selected rows, preserving the default descriptions, colors, and
   icons where they exist. Send only the wire fields; the UI-only `selected` and `isDefault` flags
   stay in the draft.
3. Build the avatar payload: `image: avatarTouched ? avatarDataUrl : undefined` (`null` when the
   person removed a photo).
4. Call `completeOnboarding('personal', { archiveAutoDelete, captureBehavior, starterContent,
   image })`.
5. On success, write the local choices:
   - `setShowLabelNames`, `setColorFirstLabels`
   - `setSkipCompleteConfirm(!askBeforeComplete)`
   - `setActionNotifications`, `setDesktopNotifications`
   - `setInsightDismissed(!dailyInsights)`
   - `setLoginTipDismissed(true, false)` — session-only, prevents a duplicate shell tip this
     session; the future-session default remains governed by the setting.
   - `setWorkspaceType('personal')`, `setOnboardingCompleted()`
   - Theme is already persisted by `ThemeService`.
6. Clear the wizard draft.
7. If `firstTaskTitle` is non-empty, `POST /tasks` with `{ title, status: 'inbox' }`. Starter
   projects and labels exist by now. A failure here is logged and does not block navigation.
8. Navigate with `authState.getPostAuthRedirectUrl()`.

### 6.4 Failure handling

- If the `PATCH /me` fails, remain on the Ready step, show an inline error
  ("Could not finish setting up. Please try again."), and re-enable the button. Do not write local
  completion flags and do not navigate.
- If the failure is a `starterContent` validation error, return to the starter step, highlight the
  offending name, and keep the rest of the draft. If it is an `image` validation error, return to
  the Welcome step and show the message beside the avatar control. Do not strand the person on
  Ready with a generic message they cannot act on.
- The request is idempotent from the client's perspective: retrying sends the same payload. The
  server seeds only on the transition and skips existing names, so a retry after a partial failure
  is safe.
- Multi-tab: if one tab completes first, the second tab's PATCH is harmless; the guard then
  redirects on its next navigation.
- If the user is signed out mid-flow, the guard sends them to `/login`; the draft remains keyed by
  user id and resumes after sign-in. A 401/403 from the completion request means the session
  ended; navigate to `/login` instead of offering a retry loop.

## 7. Gaps and additions beyond the brief

These are the things the original request did not name but a shippable wizard needs.

1. **Resume and refresh safety.** Without a draft, a refresh resets the flow and a wizard feels
   fragile. User-scoped draft plus `?step=` solves it.
2. **A skip path.** The onboarding guard makes `/onboarding` the only reachable destination while
   incomplete, so a wizard with no escape is a hard trap.
3. **One completion request.** Calling `updateProfile` and `completeOnboarding` separately creates
   a window where the server says onboarding is complete but behavior prefs, starter content, or
   the avatar are not saved. Combine them.
4. **Duplicate first-run tip.** The shell opens a blocking random tip immediately after onboarding
   (`personal-shell.component.ts:190-192`). The wizard must suppress it for that session or the
   new account sees two onboarding surfaces in a row.
5. **Shared theme catalogue.** The nine ids are duplicated in `ThemeService`, and labels live in
   the settings template. Extract `THEMES`, `DEFAULT_THEME`, and `isDarkTheme()` into one module
   used by the service, Settings, and the wizard. This is required for a nine-card picker and
   removes an existing maintenance hazard.
6. **Shared tips catalogue.** Export `TIPS` with stable ids and text, add `WIZARD_TIPS`, and audit
   every entry against the shipped UI. Remove the `?` shortcut, batch-action, and drag-to-reorder
   tips until those features exist. The shell should render `TIP.text`, not a bare string.
7. **Correct confirmation semantics.** The wizard must not copy the inverted settings label. It
   should ask a plain question ("Ask before completing tasks") and map it to
   `skipCompleteConfirm` correctly.
8. **Selectable starter content.** The server silently creates seven projects and six labels
   today. The wizard needs the shared default catalogues, per-item selection, custom additions,
   and an explicit seeding payload. This is a selection contract, not a single opt-out flag.
9. **First task capture.** Creating one task from the wizard warms the empty state and teaches
   capture. It is optional and must happen after completion, because starter projects do not
   exist before the transition.
10. **Cross-device and shared-browser preference scope (follow-up).** Themes and display
    preferences are localStorage-only and keyed globally, not by user. A new device starts at
    Light Forest; two accounts on the same browser inherit each other's theme and display toggles.
    Recommended follow-up: add a nullable `theme` column to `user` (validated against the nine
    ids), expose it in `PublicUser`/`UpdateProfile`, and have `ThemeService` apply the server value
    only when this browser has no local `yotara-theme`. Namespace local preference keys by user id
    (reading the legacy key as a fallback). This needs a schema/bootstrap change and a conflict
    rule (local device wins), so it is not part of the core wizard.
11. **Dead preview route.** `preview/picker` currently loads the onboarding component without
    auth guards. Once the component expects an authenticated user and draft, remove the route or
    replace it with an explicitly dev-only fixture preview.
12. **Legacy accounts.** Any account created before this ships with `onboardingCompleted = false`
    will see the wizard on next sign-in. That is acceptable and needs no backfill, but the release
    note should say so.
13. **No telemetry.** Do not add analytics around step completion. Yotara's self-hosted privacy
    position rules it out; any future measurement must be opt-in and local.
14. **Project deletion follow-up.** The user plans to delete projects later. `projects.retiredAt`
    already exists, but no route or UI exposes it. Until a `DELETE /projects/:id` (retire or hard
    delete) ships, the wizard copy must say "rename these later", not "remove". When deletion
    ships, update the copy and add a restore/safety rule for projects that still contain tasks.
15. **Shared avatar component and client-side photo processing.** Both shells compute initials
    independently with different fallbacks (`PS` and `YT`), and `user.image` is returned by the API
    but never rendered. Add `getInitials()`, `app-avatar`, and a reusable `AvatarEditorComponent`,
    then use them in both shells, the wizard, and the new Settings row. Use `ngx-image-cropper` for
    square crop and 256×256 output, store the result as a data URL in `user.image`, and keep
    initials as the fallback. No image bytes are uploaded to a file store or third party.
16. **Documentation.** Add this plan to the Active plans table in `docs/README.md`, and update the
    onboarding paragraph in `PROJECT_README.md` only if the route or guards change (they do not).

## 8. Implementation outline

### 8.1 New files

| File | Purpose |
|:---|:---|
| `apps/frontend/src/app/core/constants/themes.ts` | `THEMES`, `DEFAULT_THEME`, `isDarkTheme()`; single source for ids, labels, tone |
| `apps/frontend/src/app/core/constants/tips.ts` | `Tip` type, `TIPS`, `WIZARD_TIPS`; audit of shipped features |
| `packages/shared/src/default-projects.ts` | `DefaultProject`, `DEFAULT_PROJECTS`, moved from the API service |
| `apps/api/src/lib/starter-content.ts` | Validation and normalization for the starter content payload |
| `apps/frontend/src/app/features/onboarding/pages/startup-wizard/startup-wizard.component.ts` | Step state, draft persistence, completion, skip, first task |
| `.../startup-wizard.component.html` | Six step templates, progress, footer |
| `.../startup-wizard.component.css` | Full-screen layout, theme cards, starter lists, responsive rules |
| `.../startup-wizard.component.spec.ts` | Step, draft, completion, starter selection, skip, error, and a11y tests |
| `apps/frontend/src/app/features/onboarding/components/theme-picker.component.ts` | Optional split-out radio-group theme grid |
| `apps/frontend/src/app/features/onboarding/components/starter-content-step.component.ts` | Optional split-out project/label selection panels |
| `apps/frontend/src/app/shared/components/avatar/avatar.component.ts` | Shared initials/photo avatar with size variants |
| `apps/frontend/src/app/shared/components/avatar/avatar-editor.component.ts` | Reusable modal with file picker, `ngx-image-cropper`, save/remove, and validation copy |
| `apps/frontend/src/app/shared/utils/initials.ts` | `getInitials(name, email)` used by both shells and the wizard |
| `apps/frontend/src/app/shared/utils/avatar.ts` | MIME/size validation, data-URL length check, and safe data-URL binding helper |
| `apps/frontend/e2e/fixtures/avatar.png` | Small fixture image for the Settings and wizard upload tests |

### 8.2 Modified files

| File | Change |
|:---|:---|
| `apps/frontend/src/app/app.routes.ts` | Point `/onboarding` at `StartupWizardComponent`; remove or guard `preview/picker` |
| `.../core/services/theme.service.ts` | Use `THEMES`/`isDarkTheme` instead of three duplicated arrays |
| `apps/frontend/package.json` | Add `ngx-image-cropper` (MIT, 9.x; peer range `>=17.3.0`) |
| `.../features/personal/pages/settings-page.component.ts` | Add the Profile photo row, avatar preview, and editor; keep the theme options from the catalogue |
| `.../features/personal/shell/personal-shell.component.ts` | Import `TIPS` from the catalogue; render `tip.text`; replace inline initials with `app-avatar` |
| `.../features/personal/shell/personal-shell.component.html` | Use `app-avatar` in the profile button |
| `.../features/shell/auth-shell.component.ts` | Replace inline initials/computed with `app-avatar` |
| `apps/frontend/src/app/features/onboarding/pages/start-screen/*` | Delete after migration (do not leave two onboarding screens) |
| `packages/shared/src/index.ts` | Export `DEFAULT_PROJECTS` and the starter content types |
| `packages/shared/src/auth.ts` | Extend `completeOnboarding`/`updateProfile` with `OnboardingPreferences`, `StarterContent`, and `image` |
| `.../core/services/auth-state.service.ts` | Accept `image` in `completeOnboarding` and `updateProfile` |
| `apps/api/src/services/project-service.ts` | Import shared defaults; seed a supplied project list |
| `apps/api/src/services/label-service.ts` | Seed a supplied label list; keep idempotency |
| `apps/api/src/routes/me.ts` | Accept, validate, and store `starterContent` and `image`; seed the selection on transition |
| `apps/api/src/docs/openapi.ts` | Add `starterContent` and `image` to `UpdateProfile`; allow data-URL `AppUser.image` |
| `apps/frontend/e2e/global-setup.ts` | Walk the wizard instead of clicking a single Continue |
| `apps/frontend/e2e/specs/authenticated/onboarding.spec.ts` | Cover both signup modes, skip, starter selection, avatar, and the completed state |
| `DOCKER.md` | Note that profile photos are data URLs and `img-src` must include `data:` when overriding the CSP |
| `docs/README.md` | Add this plan to Active plans |

### 8.3 Work breakdown: three parts

This is the execution order. Each part is one branch and one reviewable PR; Part 3 may be split
into three smaller PRs. A later part starts only after its dependency lands, except the Part 3 API
work, which can run in parallel with Part 2.

#### 8.3.0 Before Part 1

- Confirm the defaults in §12. This plan assumes 5 MB input, 256×256 output, initials as the
  fallback, and `ngx-image-cropper`.
- Branch from `main` and record a green baseline:
  `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`.
- No database migration is required in any part. `users.image` already exists; starter content
  adds rows, not columns.
- Update the OpenAPI schema before a client sends new `PATCH /me` fields. `UpdateProfile` uses
  `additionalProperties: false`.
- Do not add telemetry, hidden preferences, or a new Settings control that is not in this plan.
- Keep one completion request. The only server writes before completion are Settings edits the
  person makes outside the wizard.

#### Agent start kit

Read these before changing code:

- This plan, especially §2–§7 and §10.
- `apps/frontend/src/app/features/onboarding/pages/start-screen/*`
- `apps/frontend/src/app/app.routes.ts`
- `apps/frontend/src/app/core/guards/onboarding.guard.ts`
- `apps/frontend/src/app/core/services/auth-state.service.ts`
- `apps/frontend/src/app/core/services/preferences-store.service.ts`
- `apps/frontend/src/app/core/services/theme.service.ts`
- `apps/frontend/src/app/features/personal/pages/settings-page.component.ts`
- `apps/frontend/src/app/features/personal/shell/personal-shell.component.{ts,html,css}`
- `apps/frontend/src/app/features/shell/auth-shell.component.ts`
- `apps/api/src/routes/me.ts`, `apps/api/src/docs/openapi.ts`, `apps/api/src/db/schema.ts`
- `apps/api/src/services/project-service.ts`, `apps/api/src/services/label-service.ts`
- `packages/shared/src/auth.ts`, `packages/shared/src/default-labels.ts`,
  `packages/shared/src/domain.ts`
- `apps/frontend/e2e/global-setup.ts`,
  `apps/frontend/e2e/specs/authenticated/onboarding.spec.ts`

#### Part boundaries

| Part | User-visible result | API changes | New dependency | Migration |
|:---|:---|:---|:---|:---|
| **1. Foundations** | None; shared primitives only | None | None | None |
| **2. Core wizard** | Four-step wizard for new accounts; initials; default starter content | None; uses existing `PATCH /me` fields | None | None |
| **3. Personalization** | Six-step wizard; starter selection; photo; first task; Settings Profile photo | `starterContent`, `image` on `PATCH /me` | `ngx-image-cropper` | None |

---

#### Part 1 — Shared foundations (behavior-neutral)

**Outcome:** catalogues and primitives exist, but the onboarding route and every visible flow are
unchanged. This de-risks the later parts and is the smallest reviewable PR.

**Branch / PR:** `feat/startup-wizard-foundations`

**Suggested commit:** `refactor: add shared theme, tip, starter, and avatar primitives`

**Work**

1. Add `apps/frontend/src/app/core/constants/themes.ts`:
   - `ThemeOption { id, label, isDark }`, `THEMES`, `DEFAULT_THEME`, `isDarkTheme()`.
   - Reuse the existing `Theme` union or re-export it; do not rename stored ids.
   - Refactor `theme.service.ts` to use the catalogue instead of its three duplicated arrays.
   - Render the Settings theme `<select>` from `THEMES` so ids and labels stay in sync.
2. Add `apps/frontend/src/app/core/constants/tips.ts`:
   - `Tip { id, text }`, `TIPS`, `WIZARD_TIPS`.
   - Update `personal-shell.component.ts` to import `TIPS` and render `tip.text`.
   - Remove tips that describe unshipped features (`?` shortcut sheet, batch actions,
     drag-to-reorder in lists). Audit the rest against the current UI.
3. Move `DEFAULT_PROJECTS` from `apps/api/src/services/project-service.ts` into
   `packages/shared/src/default-projects.ts`:
   - Export `DefaultProject`, `DEFAULT_PROJECTS`, and `DEFAULT_LABELS` from
     `packages/shared/src/index.ts`.
   - Update the API services to import the shared catalogues. Behavior must not change.
4. Add `apps/frontend/src/app/shared/utils/initials.ts` with `getInitials(name, email)`:
   - First letters of the first two words; single word uses its first letter; empty name falls
     back to the email's first letter, then `Y`; use grapheme-safe iteration.
5. Add `apps/frontend/src/app/shared/components/avatar/avatar.component.ts`:
   - Inputs: `image`, `name`, `email`, `size` (`sm`/`md`/`lg`).
   - Render the image when present, otherwise initials; `object-fit: cover`; theme-tinted initials.
   - Only bind `data:image/(png|jpeg|webp)` URLs through a safe-value helper. Keep the whitelist in
     `apps/frontend/src/app/shared/utils/avatar.ts` so Part 3 can extend it.
   - Replace the duplicated `userInitials` computed logic in both shells and the inline `.avatar`
     markup; delete the now-unused `PS`/`YT` fallbacks.
6. Tests:
   - Theme catalogue: nine ids, labels, dark flags.
   - Tip catalogue: stable ids; no ghost-feature copy.
   - Shared default catalogues: seven projects, six labels, stable names.
   - `getInitials`: two words, one word, empty/email fallback, non-Latin.
   - `app-avatar`: image vs initials; unsafe URL is not bound.

**Not in this part**

- No wizard component, route change, step state, or draft persistence.
- No `PATCH /me` changes.
- No `ngx-image-cropper` dependency and no photo editor.
- No starter-selection UI.

**Definition of done**

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check` pass.
- [ ] The old onboarding screen still works; no route or visible flow changes.
- [ ] Both shells use the same initials helper and render the same value for the same user.
- [ ] `ThemeService` and Settings use one theme catalogue.
- [ ] `TIPS` contains only statements true of the shipped UI.

**Risk:** low. The only cross-cutting change is moving `DEFAULT_PROJECTS` into `shared`; keep the
API imports and tests unchanged in the same commit so a regression is obvious.

---

#### Part 2 — Core wizard (first usable release)

**Outcome:** a working wizard with Welcome, Look & feel, Workflow & notifications, and Ready.
Starter content uses the server's existing default seeding; avatars are initials only. This is the
first point a new account can use the new flow.

**Precondition:** Part 1 merged.

**Branch / PR:** `feat/startup-wizard-core`

**Suggested commit:** `feat: replace onboarding with the startup wizard core`

**Work**

1. Add `apps/frontend/src/app/features/onboarding/pages/startup-wizard/`:
   - `startup-wizard.component.ts`, `.html`, `.css`, `.spec.ts`.
   - Step model: `'welcome' | 'look' | 'defaults' | 'ready'` (four steps). Part 3 inserts
     `'starter'` and `'tips'` to reach the six-step target; note this in a code comment.
2. Swap the route:
   - Point `/onboarding` at `StartupWizardComponent`; keep `authGuard` + `onboardingGuard`.
   - Remove `preview/picker`, or replace it with an explicitly dev-only fixture preview.
   - Delete `start-screen.component.*` and its spec in the same PR.
3. Build the shell:
   - Full-screen layout from `start-screen.component.css`; brand header; signed-in email;
     **Not you? Sign out**; **Skip setup**.
   - Footer **Back** / **Continue**; six-dot indicator becomes four dots in this part; progress
     live region; focus moves to the step heading; reduced-motion handling; mobile layout.
4. Step 1 — Welcome:
   - Greeting from `authState.user()?.name`; `?created=1` note; initials avatar only.
   - No photo control yet.
5. Step 2 — Look & feel:
   - Theme grid from `THEMES`; live `ThemeService.setTheme`; `showLabelNames`; `colorFirstLabels`.
   - Apply each card's `theme-<id>` class locally for the swatch preview.
6. Step 3 — Workflow & notifications:
   - `captureBehavior`, `archiveAutoDelete`, ask-before-complete (`skipCompleteConfirm` inverted),
     `actionNotifications`, `desktopNotifications` (permission on toggle), `dailyInsights`,
     `loginTips`. Label and helper copy mirrors Settings.
7. Step 4 — Ready:
   - Summary of theme, behavior, notifications, and insights; note that the default starter projects
     and labels will be created.
   - No starter selection, no tips, no first task yet.
8. Draft and navigation:
   - `localStorage['yotara_wizard_draft:<userId>']` with a 24-hour expiry; version the shape.
   - The Part 2 draft type omits avatar and starter fields; Part 3 extends it and bumps the version.
   - `?step=` with `replaceUrl: true` and `queryParamMap` sync; Back/Continue; skip.
   - No server writes until completion.
9. Completion:
   - One `PATCH /me` with `workspaceMode: 'personal'`, `onboardingCompleted: true`,
     `archiveAutoDelete`, and `captureBehavior`; do not send `starterContent` or `image`.
   - Write local preferences; session-only login-tip suppression; clear the draft; navigate with
     `getPostAuthRedirectUrl()`.
   - Retry stays on Ready; 401/403 goes to `/login`.
10. Update E2E:
    - Add a `completeWizard(page)` helper in `e2e/fixtures/auth.ts` or the spec.
    - Update `e2e/global-setup.ts` and `onboarding.spec.ts` to walk the four steps.
    - Keep the `onboarding` Playwright project signed out.

**Not in this part**

- Starter projects/labels selection and the `starterContent` API.
- Tips step, first-task field, and any `image` handling.
- `ngx-image-cropper`.

**Definition of done**

- [ ] Both signup modes reach `/onboarding`, complete the four-step wizard, and land on `/tasks`.
- [ ] Theme, label display, capture behavior, auto-clear, completion confirmation, notifications,
      insights, and login-tip choices are saved and reflected in Settings.
- [ ] The default seven projects and six labels exist after completion (existing server path).
- [ ] Sign-out and skip work; a refresh resumes at the same step; a failed completion retries.
- [ ] The old `StartScreenComponent` and `preview/picker` dead route are gone.
- [ ] Updated E2E passes; `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check` pass.

**Risk:** medium. Swapping the route breaks the existing E2E setup, so update
`global-setup.ts` in the same PR. Keep the PR limited to the four-step subset; do not start Part 3
in the same branch.

---

#### Part 3 — Personalization (complete the plan)

**Outcome:** the full six-step wizard, selectable starter projects and labels, curated tips, an
optional client-processed photo with a Settings row, and an optional first task.

**Precondition:** Parts 1 and 2 merged. The API portions of 3a/3b can start in parallel with Part 2
because they only add fields to `PATCH /me`.

**Branch / PR:** `feat/startup-wizard-personalization` (prefer three small PRs: 3a, 3b, 3c)

**Suggested commits**

- `feat: selectable starter projects and labels during onboarding`
- `feat: client-processed profile photos`
- `feat: onboarding tips and first task`

**3a — Starter projects and labels**

1. Add the `'starter'` step after Workflow. It sits before Ready until 3c inserts the Tips step;
   update the step model and indicator to six when Tips lands.
2. Extend the draft with `StarterProjectDraft[]` and `StarterLabelDraft[]`; rehydrate default
   metadata from the shared catalogues instead of trusting stale draft copies.
3. Build the two panels: defaults preselected, per-item checkboxes, **Add project** and **Add
   label** inputs, remove custom rows, **Use default suite**, **Start empty**, live count, dedupe
   against all rows (including deselected defaults).
4. API:
   - Extend `PATCH /me` with `starterContent` (`projects`, `labels`).
   - Add `apps/api/src/lib/starter-content.ts` validation: max 50 each, names 1–80, descriptions
     ≤200, case-insensitive dedupe, valid project colors/label colors/icons.
   - Make `seedDefaultProjectsForOwner(ownerId, projects?)` and
     `seedDefaultLabelsForOwner(ownerId, labels?)` accept the selection; omit → defaults; empty →
     nothing; ignore on non-transition/team.
   - Drop the label seeder's "any labels exist" early return and rely on `onConflictDoNothing()`.
   - Prefer one transaction for both seeders and the `users` update. If not feasible, document the
     additive-retry caveat.
   - Update `UpdateProfile` in OpenAPI and `OnboardingPreferences`/`AuthStateService`.
5. Update the Ready summary to show the selected counts/names; map `starterContent` validation
   errors back to this step.

**3b — Profile photo**

1. Add `ngx-image-cropper` to `apps/frontend/package.json`; verify `pnpm build` under Angular 22.
2. Add `AvatarEditorComponent`:
   - File input (`accept="image/png,image/jpeg,image/webp"`), 5 MB limit, MIME check.
   - Square cropper, 256×256 resize, WebP quality 82, EXIF handling, accessible labels.
   - Normalize the result to a full data URL; accept PNG/JPEG if WebP is unavailable.
   - Save/cancel plus inline validation and error messages; reset the file input after selection.
3. Wire the Welcome step: initials by default; **Add photo**, **Change**, **Remove**; draft
   `avatarDataUrl` and `avatarTouched`; include `image` in the completion PATCH when touched.
4. Add the Settings **Profile photo** row under Account:
   - `app-avatar` preview plus Add/Change/Remove.
   - Save via `updateProfile({ image })`; remove via `updateProfile({ image: null })`.
   - Saving/error states; the copy explains that processing happens in the browser.
5. API:
   - Extend `PATCH /me` with `image?: string | null`.
   - Add `apps/api/src/lib/avatar.ts`: allow only `data:image/(png|jpeg|webp);base64,`, verify magic
     bytes, reject SVG/GIF/remote URLs/malformed base64, cap decoded size at 128 KB.
   - Store in `users.image`; `null` clears.
   - Update `UpdateProfile` and change `AppUser.image` from `format: 'uri'` to a nullable string
     with a 200,000-character cap.
6. Confirm the production CSP keeps `img-src 'self' data:`; update `DOCKER.md` with the operator
   note.

**3c — Tips, first task, and polish**

1. Add the Tips step with three `WIZARD_TIPS` cards and worked examples.
2. Add the optional first-task field on Ready; after completion, `POST /tasks` with
   `{ title, status: 'inbox' }`; a failure is logged and never blocks navigation.
3. Add unit tests for the new steps, draft fields, file validation, cropper output, Settings
   add/remove, and completion payload.
4. Extend E2E: starter subset, **Start empty**, photo add/remove, first task, both signup modes,
   skip, refresh/resume, mobile, reduced motion, keyboard flow.
5. Update `docs/README.md` (already listed), `DOCKER.md`, and the release note.

**Not in Part 3**

- Cross-device/shared-browser preference scoping (follow-up).
- Project deletion/retire endpoint and the corresponding copy change.
- Deterministic tip rotation.
- Generated nature-icon avatars and HEIC conversion.

**Definition of done**

- [ ] Every acceptance criterion in §10 passes.
- [ ] Completion is one PATCH; `starterContent` and `image` are present only when relevant.
- [ ] The starter step produces exactly the confirmed content; **Start empty** seeds nothing.
- [ ] Settings can add, replace, and remove a photo; removal falls back to initials.
- [ ] The original photo never leaves the browser; the server validates MIME, magic bytes, and
      decoded size.
- [ ] E2E covers both signup paths, skip, resume, starter subset/empty, photo add/remove, first
      task, and mobile.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`, and E2E pass.

**Risk:** medium-high. `ngx-image-cropper` is the main compatibility risk; if it fails under
Angular 22, fall back to `cropperjs` for the crop and keep the same editor contract. Starter
seeding is the second risk; a transaction is the clean answer, otherwise document and test the
additive retry.

---

#### Parallelization and review rules

| Work | Depends on | Can run in parallel with | Blocking risk |
|:---|:---|:---|:---|
| Part 1 | — | — | Moving `DEFAULT_PROJECTS` into `shared` |
| Part 2 | Part 1 | Part 3 API (3a/3b server fields) | E2E global setup/route swap |
| Part 3a starter UI | Part 2 shell + Part 1 catalogues | Part 3b | Seeding transaction |
| Part 3b photo | Part 2 shell + Part 1 avatar | Part 3a | Angular 22 cropper compatibility |
| Part 3c tips/first task | Part 2 shell | 3a/3b | None significant |

Every PR should be scoped to one part, update its tests in the same change, and run the checks in
the definition of done. Do not mix the route swap (Part 2) with the starter/photo API (Part 3) in
one PR.

## 9. Accessibility, mobile, and performance

- Theme cards: native radio inputs; selected state is text plus a check mark, never color alone;
  focus ring uses the global `:focus-visible` style.
- Cropper: pass `imageAltText` and `cropperFrameAriaLabel`; the editor modal traps focus, returns
  focus to the trigger, and announces file validation and save errors. Include short keyboard
  instructions.
- Avatar images use the person's name as alt text when standalone and `aria-hidden` when shown
  next to their name.
- Starter lists: real checkboxes with visible names; the add field has a label and an associated
  error message; the live count is an `aria-live="polite"` status.
- Step changes: move focus to the step heading, announce `Step N of M: Title` in a polite live
  region, and keep the primary action reachable by keyboard.
- Progress dots: `<ol>` with visually hidden step names and `aria-current="step"`.
- Toggles: reuse real checkbox/select controls with visible labels; do not build custom widgets.
- Reduced motion: theme changes are instant class swaps; the only step transition is opacity and
  translate, disabled under `prefers-reduced-motion: reduce`.
- Mobile: no horizontal scrolling at 320 px; theme grid becomes two columns then one; starter rows
  wrap their metadata; footer buttons stack; tap targets at least 44 px.
- Performance: the wizard makes no requests until completion (desktop notification permission is
  browser-local). Image cropping and encoding happen in the browser. Theme switching is a single
  class swap on `<html>`. Starter catalogues are in-memory constants.

## 10. Tests and acceptance criteria

### Unit tests

- Wizard renders six steps and advances/retreats without losing choices.
- Theme card selection calls `ThemeService.setTheme`, and the selected card is reported through
  accessibility state.
- Defaults initialize from `PreferencesStore`, `ThemeService`, and `authState.user()`.
- The starter step preselects the default suite and deselecting an item removes it from the
  payload.
- **Use default suite** restores all defaults and clears custom items; **Start empty** sends empty
  arrays.
- Adding a custom project or label includes it; duplicate or empty names show an error and are not
  added; removing a custom item drops it.
- Completion sends exactly one `PATCH /me` payload containing `workspaceMode`, a true
  `onboardingCompleted`, `archiveAutoDelete`, `captureBehavior`, `starterContent`, and `image` when
  the avatar was touched.
- Local preference setters receive the correct values, including the inverted
  `skipCompleteConfirm` and `insightDismissed` mappings.
- Skip completes with the current draft, including the default starter suite.
- A failed completion keeps the wizard open, shows an error, and writes no local completion flag.
- A `starterContent` validation failure returns to the starter step, identifies the offending name,
  and preserves the draft.
- Signing out from the wizard calls `authState.signOut()` and navigates to `/login`.
- A draft restores the saved step, settings, and starter selections; default metadata is rehydrated
  from the catalogue; stale or foreign-user drafts are ignored and deleted.
- `?step=` is validated; unknown values fall back to the welcome step. Step changes use
  `replaceUrl`, and a `queryParamMap` change moves to the matching step.
- Progress live region and `aria-current` are present.
- Theme catalogue and tip catalogue tests assert the nine ids, labels, dark flags, and that no tip
  references an unshipped feature.
- Shared default catalogue tests assert seven projects and six labels with stable names.
- `getInitials()` covers two-word names, single names, empty names with email fallback, and
  non-Latin graphemes.
- `app-avatar` renders initials when `user.image` is null and the image when it is set; both shells
  use the same component, and only validated `data:image/(png|jpeg|webp)` URLs are bound.
- Avatar file validation accepts JPEG, PNG, and WebP up to 5 MB and rejects SVG, GIF, HEIC, and
  oversized files with a clear message.
- The avatar editor emits a 256×256 data URL; save and remove produce the expected payload.
- Settings calls `updateProfile({ image })` on save and `updateProfile({ image: null })` on remove.
- The wizard includes `image` when the avatar was touched and omits it otherwise; removal sends
  `null`.

### API tests

- Omitting `starterContent` seeds the full default suite (backward compatibility).
- Providing a subset seeds only those projects and labels.
- Empty arrays seed nothing and still complete onboarding.
- Repeating the same completion PATCH does not duplicate projects or labels.
- If seeding is transactional, a failure between project and label insertion leaves neither set
  behind and onboarding remains incomplete. If it is not transactional, the additive-retry
  behavior is covered by a test.
- Invalid names, duplicate names, oversized lists, bad colors, and bad icons return 400 and do not
  partially seed.
- `starterContent` on an already-complete account or a team workspace is ignored without error.
- Custom labels receive a deterministic color and the default icon when omitted.
- The OpenAPI `UpdateProfile` schema accepts `starterContent` and still rejects unknown fields.
- Valid PNG/JPEG/WebP data URLs are stored in `user.image`; `null` clears it.
- SVG, GIF, remote URLs, malformed base64, and oversized payloads return 400 and leave the user
  unchanged.
- The OpenAPI `UpdateProfile` schema accepts `image`; `AppUser.image` allows data URLs.

### E2E tests

- Both signup modes reach the wizard and complete it to `/tasks`.
- `e2e/global-setup.ts` and `onboarding.spec.ts` are updated for the new flow; the
  `onboarding` Playwright project still runs signed out.
- Choosing a dark theme in the wizard is still applied after reload and is reflected in Settings.
- Skipping from the welcome step completes onboarding and lands on the task list with the default
  starter suite.
- Refreshing mid-wizard resumes at the same step with settings and starter selections intact.
- Deselecting one default project and adding a custom project and label results in exactly that
  content after completion.
- **Start empty** leaves the Projects and Labels views empty.
- Signing out from the wizard returns to `/login` and leaves onboarding incomplete and resumable.
- Uploading a photo in Settings updates the shell avatar and survives a reload; removing it returns
  initials.
- Adding a photo in the wizard persists it after completion.
- A production CSP response renders a data-URL avatar (`img-src` includes `data:`).
- Mobile project: the wizard is usable at Pixel 7 width with no horizontal overflow.

### Acceptance criteria

- [ ] A new account, by either signup path, lands on the wizard and cannot reach the app until it
      completes or is skipped.
- [ ] The wizard does not ask for account details already collected at signup.
- [ ] All nine themes preview live and the choice survives a reload.
- [ ] Every configurable control corresponds to an existing Settings row; no internal or
      calendar-only preference appears.
- [ ] Theme, label display, capture behavior, auto-clear, completion confirmation, notifications,
      insights, and login-tip choices are saved and reflected in Settings.
- [ ] Starter projects and labels can be kept, deselected, extended with custom names, or cleared;
      the resulting workspace contains exactly the confirmed selection.
- [ ] Completion is one request; retry after failure is safe and idempotent. Starter seeding is
      atomic, or additive-retry behavior is documented and tested.
- [ ] A person can sign out from the wizard; onboarding stays incomplete and resumes for the same
      account.
- [ ] A profile photo can be added, replaced, and removed in the wizard and in Settings; it is
      stored as a 256×256 data URL in `user.image`, and removal falls back to initials.
- [ ] The original file is never uploaded and no multipart route exists; the server validates MIME,
      magic bytes, and decoded size.
- [ ] The shell does not show a second blocking tip immediately after the wizard.
- [ ] Copy does not promise project deletion until that endpoint ships.
- [ ] Keyboard-only and screen-reader flows are complete; reduced-motion preference is honored.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and the Playwright suites pass.

## 11. Out of scope

- Team workspace selection or team onboarding.
- Account creation, password setup, email verification, or profile editing beyond the photo.
- Import from other task managers.
- Generated nature-icon avatars (the photo path is in scope).
- HEIC input; ask for a JPEG/PNG/WebP, or add a browser-side converter later if iPhone uploads
  demand it.
- Server-side image hosting, multipart uploads, or remote avatar services.
- Two-factor authentication and email digests.
- Editing or renaming starter projects and labels inside the wizard; that happens on the Projects
  and Labels pages.
- Color and icon pickers for custom starter projects and labels; the server assigns sensible
  defaults.
- The project deletion/retire endpoint itself. It is a planned follow-up, and the wizard copy must
  stay accurate until it ships.
- Calendar-only preferences and other internal localStorage keys that are not in Settings.
- Week-start, date-format, default-view, and sort-order settings (none exist today).
- A real keyboard-shortcuts sheet, batch actions, or drag-to-reorder in lists; tips must not
  pretend otherwise.
- Analytics or remote measurement of step completion.
- Server-side syncing of every localStorage preference; only the optional theme follow-up is
  proposed.

## 12. Open questions

1. Should the first task be created in the Inbox or Today? Inbox matches the capture-first model
   and is the first view after onboarding; Today is more immediately rewarding. This plan assumes
   Inbox.
2. Should custom starter labels and projects get color/icon pickers, or keep the wizard name-only
   and defer styling to the Projects and Labels pages? This plan keeps the wizard name-only.
3. When project deletion ships, should starter projects be retireable (preserve tasks) or hard
   deleted? The schema's `retiredAt` suggests retire-first.
4. Should the wizard's confirmation preference change the shipped default for existing users, or
   only set it for new accounts? This plan changes it for new accounts only.
5. Should a "match system" theme be added to Settings and the wizard? It does not exist today;
   adding it means `ThemeService` must resolve `prefers-color-scheme` and listen for changes.
6. Is rejecting HEIC acceptable, or should we add a browser-side HEIC converter? This plan rejects
   it with a clear message.
7. If `ngx-image-cropper` fails under Angular 22, should we fall back to `cropperjs` directly or
   pin a compatible wrapper? Its peer range is `>=17.3.0`, so verify during implementation.
8. Is 5 MB the right input cap, or should we match GitHub's stricter 1 MB? This plan prefers 5 MB
   for phone photos because the browser resizes before anything is sent.
