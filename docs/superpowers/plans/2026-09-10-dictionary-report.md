# Family-friendly dictionary report

## Policy and boundaries

The shared policy lives in `src/content/dictionary-policy.json`. Both Python generators load it before selecting meanings, while the browser dictionary loader, HSK loader, vocabulary-bank insertion, and saved-bank normalization apply the same rules at runtime. Word overrides handle exceptional learner meanings; sense patterns remove an unsuitable sense without discarding useful senses on the same headword.

The override for 黄 produces `huáng` and `yellow`. Vocabulary-bank normalization preserves an existing ID (or derives the same stable ID when an old save has none), preserves audio references, cleans definitions, and drops only entries left with no allowed sense.

## Generated-data audit

Relative to the pre-change generated dictionary, regeneration changed 159 headwords and removed 188 headwords that had no remaining allowed sense. The dictionary now contains 114,661 headwords. All 159 mixed-sense entries retained at least one useful meaning.

The HSK sanitization changed 5 records and removed 0 words from the current 5,363-word list. No HSK IDs changed, and the generated list still has 5,363 unique IDs.

The policy patterns use word boundaries and target meanings rather than character substrings. The audit checked every generated entry by reapplying the runtime sanitizer and confirmed that each entry is unchanged by a second pass. This catches both missed prohibited senses and accidental partial-word matches. Mixed-sense entries were retained, and the exceptional color entry was checked in both assets. No false-positive removal was found in the retained-sense or stable-ID checks.

## Regeneration protection

`scripts/build-dictionary.py` and `scripts/build-hsk.py` apply the shared policy before truncating meanings, so an unsuitable early sense cannot displace a useful later one. They print filtered-sense and removed-entry counts. `scripts/sanitize-generated.py` provides a deterministic migration for already-built assets and writes reproducible gzip output.

## Verification

The focused policy suite passed 4/4 tests. Python compilation, content validation, and the production build also passed. The complete unit run passed 25/26 tests; its sole failure is the concurrently edited hunger-rate expectation in `tests/living.test.js`, outside this task's dictionary scope. The build retained the project's existing JSON-import and large-bundle warnings.
