# ⚠️ STASH ARCHIVE — DO NOT MERGE

This branch (`stashlist`) is an archive of the repository owner's local Git stashes.
It is **not a feature branch**.

> **NO MERGE.** Do not merge, rebase, or cherry-pick this branch into `main` or any other
> branch. The snapshots are work-in-progress, come from unrelated branches, and are not a
> coherent history.

## Recovery

Fetch the branch, then apply the stash commit you need:

```bash
git fetch origin stashlist

# List archive entries (newest first)
git log --first-parent --oneline origin/stashlist

# Restore one stash (use the stash commit SHA from the table below)
git stash apply <stash-sha>
git stash apply --include-untracked <stash-sha>   # if it had untracked files
```

Use the commit SHA, not the `stash@{N}` index — local indexes shift.

## Index

The **Stash entry** column matches what `git stash list` showed when this archive was
created. The underlying stash commit can carry an older message; the SHA is authoritative.

| # | Date | Base | Stash commit | Stash entry |
|---|------|------|--------------|-------------|
| 0 | 2026-10-20 12:19:48 +0530 | `80bbe09` | `1fa9acb91ea6aafe278d51ffb5c4d45c3fddfc53` | On fix/docker-restart-policy: manual task reordering plan |
| 1 | 2026-10-17 14:15:35 +0530 | `ca9b9b0` | `08ce125c261496996e1bc4d23ef352f9bd545807` | On feat/marketing-site-refresh: blog: correct next-friday example, timezone wording, push privacy wording |
| 2 | 2026-09-10 18:46:10 +0530 | `95b56dd` | `91949cb70640434ed0de954e208af61fa9efd5f0` | On feat/mobile-task-workflow: wip: mobile-task-workflow modal edits (preserve for feat/mobile-task-workflow) |
| 3 | 2026-09-08 19:45:51 +0530 | `95b56dd` | `0bf1861520bf982b1762e79b9d19488cef39612c` | On feat/mobile-task-workflow: wip: manual CD plan doc |
| 4 | 2026-09-02 16:55:16 +0530 | `8331739` | `d387a3436bed21df2de8cd5fa0fec0da96d1f24d` | WIP on bug/release-native-arm64-runners: 8331739 fix(ci): use native arm64 runners in release docker builds |
| 5 | 2026-08-24 18:15:58 +0530 | `8d97ffd` | `74844258f0ffcbbd984da5f78ed05f4b4d6daefa` | On beta-release: beta-2 precheck WIP |
| 6 | 2026-08-12 14:43:43 +0530 | `8eaac1a` | `b6043e29c53f53adbe2d7407d537d04319f3fe84` | On misc/fix-notifcation-css: anti-patterns-audit WIP |
| 7 | 2026-06-15 16:24:34 +0530 | `e850a0d` | `89a484c890159b9d0a648c69a54d2a222a4c0302` | On feat/suggestion-tooltips: feat: suggestion/tooltip system with localStorage persistence |
| 8 | 2026-05-28 16:37:50 +0530 | `8d8a4c6` | `856bb8101c6c8b953bfc063f44d8c3ca48d6f326` | WIP on main: 8d8a4c6 chore(release): 0.51.4 |
| 9 | 2026-03-14 10:37:57 +0530 | `f92d820` | `ff2491b71993235a61bbd1706b671a3711c6091a` | filter-branch: rewrite |
| 10 | 2026-03-14 10:37:57 +0530 | `f92d820` | `db91963f1223a1d5af9bae36e9843693edfb5a24` | WIP on auth-flow: 06f029d Fix auth session bootstrap and origin handling |
| 11 | 2026-03-11 23:11:31 +0530 | `3baf2c0` | `129f6e4baefe3dc9e1be10fe7e2668e8bea6b84f` | WIP on main: 412c94d Merge pull request #4 from apauldev/entry-screen |
| 12 | 2026-03-11 15:26:50 +0530 | `7381d76` | `1a31d3264065384c2a4515fe46776d2d1038f147` | WIP on entry-screen: ca7b771 The startup screen and login screen created |
| 13 | 2026-03-08 15:41:53 +0530 | `07d9a26` | `3729b936e78ed735e99a4c8631fec945fbee08c4` | WIP on entry-screen: 773b8f9 Merge pull request #3 from apauldev/feat/install-spartan-ui |
