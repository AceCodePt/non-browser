---
wait_human_start: false
wait_human_merge: false
dependencies: []
---

# Task: Remove the /home/sagi hardcode from safari config; drop the dead Droid Sans Japanese coverage row; mark the safari track probe-only

## Metadata

- **Complexity:** Low
- **Priority:** Medium
- **Status:** Ready for Handoff

## Context

Finding QA-11 of docs/ledgers/quality-audit.md. src/config/safari.ts:34 hardcodes '/home/sagi/.local/share/fonts/HackNerdFont-Regular.ttf' — a machine-specific absolute path that violates the repo's own stated policy (src/config/chrome.ts:21-27: paths never hard-code a home directory; env override first, then the repo-vendored copy under fonts/, which already exists as fonts/HackNerdFont-Regular.ttf). Also chrome.ts:131 lists 'Droid Sans Japanese' in scriptCoverage with no matching registration or fallback reference, and the safari config is wired but has no verification loop (unlike firefox's verify-firefox.mjs + corpus/firefox-track) — per charter §4 the WebKit oracle is parked until macOS is provisioned, so the honest disposition is a probe-only note in docs/ledgers/safari.md, not a new corpus. Read the loop protocol in docs/ledgers/quality-audit.md §"Loop protocol" before starting — it binds you.

## Requirements

- [ ] Re-verify QA-11 against HEAD first: confirm the safari.ts hardcode; grep src/ + scripts/ for every reference to 'Droid Sans Japanese' (registration, fallback tables, ledgers, scripts). If any live reference exists, do NOT remove the row — record the disproof in docs/ledgers/quality-audit.md attempt log and skip that step.
- [ ] Route the safari mono face through the chrome.ts pattern: fontPath(envVar, repoFile) with an env override (e.g. SAFARI_MONO_FONT) falling back to the vendored fonts/HackNerdFont-Regular.ttf registered RELATIVE to the repo root; absent file ⇒ face omitted so the fallback table handles the generic, exactly like chrome.ts.
- [ ] Remove the dead 'Droid Sans Japanese' scriptCoverage row only after the grep confirms zero live references.
- [ ] docs/ledgers/safari.md: add a short note that the safari config is probe-only until the WebKit oracle is provisioned (charter §4), and cross-reference QA-13 (fallback tables in ledgers are hand-mirrors pending a sync check) instead of building new machinery here.
- [ ] Update docs/ledgers/quality-audit.md (QA-11 status + attempt log + touched areas). Chain task, not the audit: no successor audit; follow-up tasks (max 3, wait_human flags false) only for important new findings.
- [ ] Obey the loop protocol verbatim (docs/ledgers/quality-audit.md §Loop protocol): worktree-only, no .orchestration/ or tmp/ or /tmp, no orch CLI, no git push, no scratch files, commit everything, tree clean.

## Verification

npm run build exits 0. node scripts/check-charter.mjs exits 0. A node one-liner importing dist/src/index.js (or dist/index.js — match the build output) prints getBrowserConfig('safari') and asserts the serialized config contains no '/home/sagi' and no missing-font absolute home path. npm run probe:browser-gap exits 0 (or follows its documented skip path).

## Prohibited Patterns

- No reads/writes/cd in .orchestration/, tmp/, /tmp, or outside the worktree; no `orch` CLI from a shell; no git push (permission prompts cannot be answered — the operator is unavailable).
- Do not create a verify-safari corpus or WebKit oracle work — the oracle is parked per charter §4; that is a registry item, not this task.
- No changes to chrome.ts's fallback tables beyond removing the verified-dead row; no tolerance edits; no fixture changes.
- No tasks created with wait_human_start or wait_human_merge true; no scratch files (temp files under docs/reports/ only, deleted before finish).
