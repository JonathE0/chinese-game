# Foundations review — Tasks 1 and 4

Read-only code review scoped to the new dictionary sanitation, controls, collision and pacing behavior. Existing staged/unstaged MVP changes were not treated as regressions merely because they differ from HEAD. No passing suites were rerun. Two targeted Node probes inspected shipped dictionary records and exercised a low-headroom step.

## Findings

- **P1 — Explicit adult definitions still ship and survive runtime sanitation** (`src/content/dictionary-policy.json:3-21`). The blacklist omits common explicit senses. The actual generated dictionary still contains `口爆` with “(slang) to ejaculate inside sb's mouth”, `哈棒` with “(Tw) (slang) to give a blowjob”, and `肛交` with “anal intercourse”. These remain accessible through lookup and can be saved because the runtime uses the same incomplete policy. Expand the sense policy with carefully scoped variants and add independent known-example tests; the current asset test only checks that the asset agrees with the same policy, so cannot detect these omissions. Preserve innocent contexts such as “social intercourse” and botanical uses rather than applying broad substring removal.

- **P2 — Step snapping can still push the head through a ceiling or beam** (`src/world/registry.js:54-60`, with horizontal admission at lines 25-26). The descending branch snaps onto any surface within STEP above the old feet position without validating head clearance at that new elevation. A targeted probe with ceiling underside 2.4, platform top 1.0, and old feet .7 gives `blocks(...,.7) === false` and `moveVertical(...,.7,.69) === {y:1, ceiling:false, grounded:true}`: the resulting head is at 2.7, inside the ceiling. The same geometry can arise beneath registered room beams with tall furniture; afterward trapped-player recovery may shove the player sideways rather than prevent clipping. Check full-body clearance before accepting a step elevation, and cover a step beneath a low beam in addition to upward jump sweeps.

- **P2 — Financial bank is mistakenly treated as a utility review panel** (`src/core/input.js:24`, `src/main.js:217-223`; `src/ui/money.js:15`). Both the vocabulary bank and financial bank use panel ID `bank`. Including this ID in UTILITY_PANELS allows numeric shortcuts to interrupt the bank counter and loan-confirmation UI, contrary to the gameplay-modal guard. Pressing 3 while at the financial bank closes it instead of opening collected-word review because the shortcut thinks the correct panel is already open. Give the word bank a distinct panel ID and add a bank-counter/loan-confirmation regression scenario.

## Other checks

Saved bank sanitation preserves existing IDs and retains the separate spaced-review record map. The new input reset paths cover blur, hidden document, pointer-lock changes, pause and warps; the finite queue and exponential drain are internally consistent. Camera placement runs in postupdate. These observations are code-review evidence, not a claim of device-specific browser verification.

