# Session Run Stop Controls

Status: `Complete`

## Goal

Let a user stop the currently active session run from anywhere in the session
workspace, and clear the rest of that session's queued work without needing to
open individual run pages.

## What changed

- Session workspace pages now show:
  - `Stop current run` when the session has an active queued, running, blocked,
    or paused run
  - `Stop all runs and clear queue` when the session has more than one active or
    queued run
- The actions are available from the shared session shell, so the controls are
  present in:
  - Overview
  - Results
  - Trip settings
  - Search strategy
  - History
  - Individual run pages

## Behaviour details

- Stopping the current run cancels the highest-priority active session run and
  then re-dispatches the single-worker queue.
- Clearing the queue cancels every active or queued run for that session and
  then re-dispatches the queue.
- The session results spinner now only reflects runnable work:
  - `queued`
  - `running`

Blocked or paused runs still count as stoppable, but they no longer make the
results tab look like live work is still progressing.

## Why this matters

FlyEasy now uses a single live Trip.com worker with a queue. Without session
level stop controls, it is too cumbersome to recover from:

- a bad run currently in progress
- a blocked run holding the queue
- an experiment suite that queued more work than the user wants to keep

These controls make the queue manageable directly from the session UI instead of
forcing the user to resolve every run one by one.
