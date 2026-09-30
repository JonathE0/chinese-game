# Roots chapter one — validation and handoff

Development worktree only. No staging, commits, push, deployment or merge performed.

## Implemented

- Grandfather's death stated in the new-player opening; letter and album remain readable with language help. Existing players retain their position and save.
- Three starter memories, a discoverable caretaker, flexible typed/microphone answers, distinct independent mastery attempts, and assisted correction without lost progress.
- Forgiving photo checks, six starter exposures, purchasable film, durable capture recovery, free replacement only when a completed memory has no local image, and separate protected story images.
- Photos generated from four screenshots of the actual town. Architecture/layout retained; captions checked against visible images. Valid off-centre fruit-stand photograph verified in browser.
- Fruit-stand reopening, manual collection, bank practice/automatic upgrade, fourth keepsake, journal and restored opening sign.
- Authoritative SQL elapsed-time ledger with caps, ownership, receipts, protected snapshots and deleted-save recovery. Browser uses confirmed saves, account checks and retry records.
- Clearly labelled, development-only admin ledger for local playthroughs; no production-time fallback.

## Evidence

- Required npm run verify: unit tests, structural content checks and production build.
- Focused browser gate: camera, cloud, food orders, shop assistants, taxis, Roots album/dialogue/recovery/business and complete admin chapter. Final result: 22/22 passed in 1.7 minutes (one worker), recorded in browser-gate.log.
- Complete admin chapter passed: practice → photograph → reopen → collect → bank practice/upgrade → fourth photo → journal → reload. chapter-album.png inspected visually.
- Real PostgreSQL (PGlite) tests passed: activation, 12-hour income, both caps, duplicate/reused request, stale save, permission boundaries, subsequent-purchase retry conflict, and deleted-save recreation.
- Independent review found three important recovery/concurrency issues; all addressed with regression checks. A final UI check also caught and fixed the welcome close button targeting a help button.

## Limits before public release

No hosted database migration was applied. Follow docs/CLOUD_SETUP.md in a separate test project before deployment. Real multi-connection tests now pass on PostgreSQL 17.10 using isolated fixture accounts. Both concurrent sessions are verified waiting on the same lock before proceeding. This validates the SQL locally; deployed Supabase authentication/RPC connectivity still requires a smoke test before release.

The 13 new Mandarin clips use neural speech. They exist and pass structural checks, but have not received a human listening review. Existing HSK mapping/native-language review notices remain. Final build retains the existing large-chunk warning. The development test ledger is confirmed absent from production assets.

## Decisions and preservation

Portable Node helpers replaced Unix-only skill scripts on Windows; original edited files are retained in the task baseline directory. This affects tooling only.

PGlite was used because native database tools were absent. This provides real SQL execution without touching live rows, but leaves multi-session hosting validation outstanding.

When the player explicitly keeps local progress during a business conflict, the dialog states that the cloud wallet and business records are retained with local learning/inventory. Both copies are backed up. Local wallet-only changes remain recoverable from the backup rather than being silently treated as server income.

The development worktree and task evidence are retained because nothing is committed or merged. No review findings were deferred as minor polish items.

## English-first onboarding follow-up

At the user’s request, the opening and Roots story guidance now start in English. Album labels, clues, next steps, camera feedback, practice controls and income messages are readable without opening translation help. Reference and player photos are labelled Then/Now. The letter is collapsible in the album. After two distinct independent successes establish one skill, Mandarin appears alongside English; English guidance remains available. This supersedes the original Chinese-first assumption for the opening chapter.

Verification: new onboarding test failed before implementation; final focused browser gate passed 10/10, including progression and the complete chapter. npm run verify passed. The album screenshot was inspected. Existing voice-review and build-size notices remain. Nothing merged or pushed.

## Remaining verification follow-up

Added the missing targeted proofs from stages 3, 5 and 8: delayed microphone callback after changing conversations, photo-profile write failure with idempotent recovery, account switch during a payout, and duplicate clicks during a pending request. All passed without product-code changes: 5/5 photo unit tests and 8/8 focused browser tests. Existing full-build results remain applicable because only tests/documentation changed. Hosted multi-session testing and human voice review remain outstanding.

## Concurrent database and content audit follow-up

The portable PostgreSQL suite passed all seven reported checks: insufficient funds/invalid actions, duplicate receipt, competing receipts, collect/upgrade race, autosave/payout race, fractional accumulation, and throttle rollback. Temporary servers are stopped in cleanup. No hosted account or database was used.

Expanded natural afternoon greetings, fruit measure-word alternatives, and polite bank requests. All offered model answers are checked against the actual matcher; negation, wrong quantities, conflicting destinations and oversized text remain rejected. The content validator now detects missing translations, duplicate IDs, unsupported examples, fractional film prices and malformed collections. New failing tests were observed before fixes.

Six focused browser tests passed, including the complete chapter and playback metadata for all 13 clips. The developer-generated listening page is docs/roots-voice-review.html, available through the development server. This is preparation for human review, not a claim that the speech has been listened to by a human. Final npm verification is recorded in continued-verify.log.

## Merge approval — 2026-09-29

The user approved the presented preview and requested merging the chapter. This records product approval; it does not certify a native-speaker language audit. The release candidate preserves the previously merged town updates and excludes local scratch files. Hosted Supabase migration and authenticated RPC smoke testing remain deployment work.
