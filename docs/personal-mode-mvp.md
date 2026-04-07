# Personal Mode MVP

This document captures what is now implemented for Yotara's personal-mode experience.

## What Shipped

- dedicated authenticated personal shell
- personal-mode route set:
  - `/inbox`
  - `/today`
  - `/upcoming`
  - `/projects`
  - `/labels`
- mode-aware redirect logic so personal users land in `/inbox`
- separate team routing so team users continue to `/dashboard`
- task-backed Inbox, Today, and Upcoming views
- placeholder-ready Projects and Labels pages
- mobile drawer behavior for the personal shell
- quick task capture from Inbox
- richer task detail modal for create and edit flows

## Personal Task Metadata

Tasks now support extra personal-mode metadata across the shared types, API, and frontend:

- `description`
- `priority`
- `dueDate`
- `simpleMode`
- `bucket`

### Current hardcoded buckets

- `personal-sanctuary`
- `deep-work`
- `home`
- `health`

## Simple Mode Behavior

Simple mode is intended for lightweight capture.

- it can be toggled while creating or editing a task
- when enabled, due-date metadata is cleared
- tasks in simple mode still support title, description, status, priority, and bucket

## Frontend Notes

The personal task modal is currently the main metadata entry point.

- Inbox capture opens the modal with the typed title prefilled
- clicking an inbox task opens the same modal in edit mode
- the modal supports bucket selection, simple mode, priority, status, and description

The personal UI also includes randomized prompt pools for:

- Daily clarity
- The Yotara Journal

Each prompt pool currently contains at least 30 prompts and rotates on successful saves.

## API / Data Notes

The existing `/tasks` API continues to back the personal flow.

- `POST /tasks` accepts personal metadata
- `PATCH /tasks/:id` updates personal metadata
- `GET /tasks` returns the enriched task shape
- SQLite bootstrap now includes `simple_mode` and `bucket`

## Verification

Verified with:

- `pnpm typecheck`
- `pnpm test`
- live local smoke checks against `http://localhost:4200` and `http://localhost:3000`

Live smoke coverage included:

- auth sign-up
- personal-mode profile state
- task create with metadata
- task update with `simpleMode`
- persistence of bucket and date-clearing behavior
