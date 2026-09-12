# Comfort and Comprehension Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement and review each task. Preserve all existing staged work; do not commit the user's MVP as part of this update.

**Goal:** Make the existing town more comfortable to explore and its language assistance more useful.

**Architecture:** Keep PlayCanvas and the existing save format. Separate sentence meaning from dictionary segmentation, use shared input-context guards, constrain player movement against room geometry, and evolve the existing procedural soundscape.

**Tech Stack:** JavaScript, PlayCanvas, Web Audio, Vite, Node tests, Playwright/Edge.

**Spec:** User's attached Developer's Vision plus the approved first milestone in this conversation.

## Global constraints

- Preserve saved progress and the current staged/unstaged MVP. Work in the existing feature checkout because its latest iteration is not committed.
- Chinese remains primary; translations are revealed on request.
- No remote translation service or credentials are configured. Deliver local authored sentence translations and explicit unavailable states for unknown sequences; never pretend concatenated glosses are a sentence translation.
- Day length: 24 real minutes. Hunger drain: 2.1 per game hour.
- Later milestones (physics props, commerce, construction, metro, Metropolis) remain outside this pass.

## Task 1: Family-friendly dictionary

Files: new shared content policy, dictionary/HSK generators and loaders, vocabulary-bank normalization, generated dictionary and HSK data, content tests.

- [x] Write and run failing behavior tests: 黄 resolves only to yellow; flagged adult senses disappear while innocent meanings remain; old saved definitions are cleaned on load.
- [x] Implement a shared data-driven policy applied at build and runtime boundaries, with word overrides and sense filtering. Audit generated dictionary/HSK data and report changed/removed counts without listing explicit terms in the player UI.
- [x] Run unit/content checks and review for false positives and preservation of stable IDs.

## Task 2: Sentence translation

Files: new translation service and authored content, src/ui/lookup.js, lookup styles, translation unit/browser tests.

- [x] Write failing tests for complete Chinese sentences, punctuation and text spanning nested elements, selections longer than 40 characters, unknown sequences, and stale asynchronous responses.
- [x] Resolve whole selected sequences against authored game text and curated phrases. Show sentence meaning above expandable dictionary details; keep word saving compatible with existing saves. Limit selections to 500 characters with an explanatory state.
- [x] Show an honest unavailable message for unknown sentences. Do not silently discard punctuation or synthesize a sentence from tokens.
- [x] Verify the actual lookup UI and existing word-saving behavior.

## Task 3: Soundscape

Files: src/services/music.js, audio tests. Parent integrates location/task hooks in src/main.js and relevant UI actions.

- [x] Remove the persistent low drone and filter procedural ambience. Use a brighter repeating composition with subtle place-specific instrumentation and task cues.
- [x] Preserve volume controls, voice ducking, muted state and browser audio lifecycle.
- [x] Verify Web Audio graph/output and transitions in a browser; avoid unbounded scheduling after suspension.

## Task 4: Controls, room collision and pacing

Files: src/world/town.js, src/world/registry.js, src/world/daylight.js, src/core/stats.js, new input helper, src/main.js, regression tests.

- [x] Reproduce ceiling penetration and stale look input with deterministic browser scenarios before modifying behavior.
- [x] Register ceiling/door lintel collision and sweep vertical body movement so jumping cannot place the head through a surface. Preserve landing, stairs/steps, and room transitions.
- [x] Use bounded finite input, clear pending motion on focus/lock/warp transitions, and exponential frame-independent look smoothing. Apply the final camera transform after simulation.
- [x] Set the 24-minute day and half hunger drain. Check sleep/reload remain safe.
- [x] Add shortcuts 1 journal, 2 inventory, 3 encountered-word review, 4 status, 5 settings. Block typing, contenteditable, dialogue, shopping and other gameplay modal contexts; allow switching utility panels. Clear held keys on focus loss.
- [x] Remove 找一找 if present; otherwise record its absence. Make review relevant to collected words and provide compact visible shortcut hints.

## Task 5: Integration and review

- [x] Run npm test, npm run check:content, npm run build, and npm run test:browser.
- [x] Inspect fresh desktop and narrow-screen screenshots, confirm no console errors, and review source changes independently.
- [x] Update README with new controls, behavior and translation limits. Report unresolved device-specific issues honestly.

## Execution ledger

- Baseline: 20 unit tests, content validation and production build passed during initial review. Existing warnings: inconsistent JSON imports and large engine bundle.
- Ruling: preserve the existing feature checkout and index rather than copying an incomplete committed snapshot into a new worktree.
- Ruling: the user's “let's get started” approves executing the proposed first milestone without another design approval round.
- Handover reconciliation: the user's subsequent report matches the newer checkout. Preserve its shopping cart UX, construction, physical props, scheduled stalls, library, financial services and composite furniture. These were inspected as existing handover work, not recreated.
- Camera integration: the current handover correctly uses PlayCanvas `prerender` for `lateUpdate`; the earlier app-level `postupdate` hook is superseded. Browser mouse-look and movement tests pass on the actual running engine.
- Foundation review: corrected low-headroom step admission, separated `wordbank` from the financial `bank` panel, and extended the content policy for omitted explicit senses. Tests reproduce the affected cases.
- Translation integration: uses authoritative library lines, ambient dialogue and introduction nodes, as well as curated translations. Consecutive library sentences can be selected together across line breaks. Unknown sequences retain the explicit unavailable state.
- UI verification: current journal contains zero repeated 小美 word rows and retains “复习你遇到的词”. Desktop and 390-pixel screenshots inspected; capture session had no page errors.
- Current full browser suite: 53/53 passed; translation-specific suite rerun after the final passage change: 3/3 passed. Original handover unit baseline: 51/51; two additional passage tests added and passed.
- No staging, commits, pushes, merges or deployment performed. Existing feature checkout and staged MVP preserved.
- Remaining expansion milestones: multi-story department store, Metropolis and metro transit, rendering optimization. They remain outside this completed comfort/comprehension pass.

- Final unit suite: 53/53 passed. Content validation and production build passed after the final translation integration. Build warnings remain for inconsistent JSON import attributes and the engine bundle size.

