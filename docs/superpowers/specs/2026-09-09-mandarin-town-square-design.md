# Mandarin Town Square: First Playable Area

## Purpose

Create a browser-based, low-poly 3D Mandarin learning game. The player is a tourist visiting a Chinese town square. They choose whom to approach; NPCs do not initiate required conversations. The first release teaches an HSK 1 self-introduction lesson and establishes reusable systems for future HSK 1 through HSK 4 areas.

## Player experience

The player explores a compact, cute low-poly town square using keyboard controls. Chinese characters are the default language display. A setting lets the player enable pinyin and English support whenever they need it.

Three approachable NPCs occupy clear locations in the square. Interacting with an NPC opens a short dialogue. The player responds by typing Chinese, selecting a prepared response, or using the microphone when browser speech recognition is available. The same dialogue works with every input method.

Background NPC pairs play short, non-blocking ambient conversations. Their Chinese speech bubbles enrich the setting and can be replayed or saved to the player's phrasebook.

## Technical architecture

### Vocabulary minigames and familiarity

An optional town-square practice stall displays several recognizable objects across the screen. The first minigame, Find the Item, presents a Chinese word and asks the player to select the matching object. After answering, the player can replay its Mandarin audio and reveal the pinyin or English help configured in settings. Rounds are untimed by default, give supportive corrections, and shuffle object positions. Initial content uses a small editable set of concrete everyday nouns with unambiguous visuals.

Future minigames reuse the same vocabulary: Listen and Find plays a Mandarin word before object selection; Name the Item presents an object for a spoken or typed answer. These later modes are expansion points rather than requirements of the first slice. Valid synonyms and appropriate alternate answers live in content data.

Each vocabulary entry has a stable identifier shared by lessons, objects, NPCs, the phrasebook, and minigames. A review module records practice by skill (recognition, listening, and production) so recognizing an item does not imply the ability to say its name. It records outcome, help used, time of review, and next due time. NPC conversation only produces word-level review evidence when the prompt actually tests that word; passive exposure is tracked separately.

The first scheduler is a simple configurable spaced-review system inspired by Anki, not Anki integration or a claimed implementation of its algorithm. Successful unassisted recall across separate reviews lengthens intervals; mistakes return a word sooner without erasing prior learning. Hinted answers receive less scheduling credit, and passive exposure never advances recall status. Immediate repeated clicks cannot inflate familiarity. Words display New, Learning, Familiar, or Review due, with per-skill details rather than a claimed probability of retention. The implementation plan must specify exact intervals and transition rules before coding.

Practice prioritizes due words, mixes in a few new words, and offers short optional sessions without blocking exploration. Speech transcription is editable before submission; recognition failures do not count as vocabulary errors or pronunciation assessments. Review records are versioned, saved with local progress, and designed for later export/import and account synchronization.

The project uses PlayCanvas for its browser-native 3D renderer and visual editor. JavaScript modules provide gameplay systems; editable JSON lesson data holds content. The PlayCanvas scene owns only spatial and visual placement. Lesson text, accepted responses, vocabulary, and conversation flow remain outside the scene so they can be edited without changing gameplay code.

### World module

Owns player movement, camera follow, interaction detection, scene boundaries, and world landmarks. It exposes an interaction event containing the selected NPC identifier.

### NPC module

Maps a scene entity to an NPC definition. Definitions contain the NPC's identifier, name, lesson reference, portrait or model metadata, idle behavior, and ambient-conversation reference. The module starts a lesson only after the player interacts.

### Lesson module

Loads a lesson by identifier and presents dialogue nodes. Each player-response node declares accepted response patterns, optional selectable answers, feedback for incorrect attempts, vocabulary rewards, and the next dialogue node. Acceptance is intent-based and supports multiple natural answers rather than one exact phrase.

The first release uses curated normalizers and accepted phrase patterns, keeping feedback deterministic for beginner material. A future language-evaluation adapter can expand acceptance without changing dialogue data or UI.

### Language-support module

Stores display preferences for Chinese characters, pinyin, and English. Chinese is always available and shown by default. Pinyin and English begin disabled and can be enabled through settings. All dialogue, ambient speech, and phrasebook entries render through this module.

### Speech module

#### NPC voice quality and playback

NPC dialogue must sound natural and human, with appropriate Mandarin tones, phrasing, pauses, and emotional delivery. Each named NPC has a consistent voice identity suited to their personality. Ambient speakers also use distinguishable voices. Robotic browser text-to-speech is not the default release voice; browser speech recognition for player input remains independent of NPC voice playback.

For authored dialogue, prefer native Mandarin voice recordings or high-quality generated Mandarin speech that passes listening review. Store approved audio as reusable assets referenced by dialogue identifiers, keeping the voice provider replaceable and any service credentials out of browser code. Reuse cached clips instead of generating speech on each interaction. Asset production must use recordings or generated voices with appropriate usage rights; no imitation of a specific real person is required.

Review every first-slice clip for intelligibility, tones, word pronunciation, conversational delivery, and agreement with the displayed Chinese. Include colloquial particles and natural sentence rhythm rather than reading each character separately. A provider's quality claims alone do not establish acceptance: actual listening review is required. The first release remains limited by the availability of approved voice assets; text-only scaffolding is not completion of this requirement.

Offer replay, separate dialogue and ambience volume controls, and a learner-friendly slower replay that preserves pitch. Keep normal playback conversational. Prevent overlapping foreground dialogue; lower ambient speech during direct NPC conversations and make nearby background exchanges audible without overwhelming the player. Begin audio after a player gesture to accommodate browser playback restrictions. If an audio clip is unavailable, preserve readable dialogue and show a replay-unavailable state rather than silently substituting an unapproved synthetic voice.

Uses browser speech recognition configured for Mandarin when supported and permitted. It sends a recognized transcript to the lesson module using the same pathway as typed text. The UI keeps typing and selectable responses available at all times. If speech recognition is unavailable, denied, fails, or returns no result, the player receives a plain-language message and continues without losing their dialogue state.

### Progress module

Stores completed lesson nodes, collected vocabulary, phrasebook entries, unlocked interactions, and support settings in browser local storage. It validates loaded data and falls back to a new profile if stored data is invalid.

## Content model

### Natural and colloquial Mandarin

Dialogue combines level-appropriate HSK learning targets with natural spoken Mandarin. NPC personality, relationship, and situation determine register: a shopkeeper can be warmly polite, friends can use relaxed everyday phrasing, and a tourist meeting someone for the first time can choose a neutral introduction. Avoid making every encounter sound like an examination or inserting slang merely for variety.

Core teaching prompts keep their target vocabulary and grammar accessible. Optional ambient exchanges and alternate replies can introduce conversational expressions beyond the current level. Mark these as everyday-language enrichment, with a plain explanation available through the configured help control; they are not required HSK mastery items. Do not assume that an expression is on an HSK list without curriculum verification.

Each dialogue line or response variant can carry register (neutral, polite, casual), usage notes, a standard equivalent, and an optional region label. Chinese remains the default display. Help can reveal the natural English meaning, pinyin, and a brief note about who would use the phrase and when. Spoken audio should match the displayed variant, including conversational particles. Start with broadly understood Mandarin; regional slang and dialect require explicit labels and suitable content review.

Curated response rules accept context-appropriate colloquial alternatives alongside standard answers. Feedback distinguishes understandable informal speech from incorrect meaning, inappropriate register, and genuinely ambiguous input; it must not correct a natural answer solely because it differs from the textbook phrasing. The game may suggest a more polite alternative without marking a suitable casual answer wrong. All accepted forms remain editable in lesson data.

For the first square, include reviewed colloquial variants in at least one NPC exchange, one shop exchange, and the ambient conversation. Review their meaning, pronunciation, context, and learning-level labels before release. Add response tests showing that both the standard and approved colloquial variants reach the intended dialogue branch while unrelated or contradictory answers do not.

### Learning currency and shops

The player earns an in-game currency called 学习币 (learning coins). It has no real-money purchase or cash-out mechanism. Coins reward completed learning activities: a first conversation completion, a completed minigame session with demonstrated learning, and successful scheduled vocabulary reviews. Passive exposure and repeatedly answering the same already-credited prompt do not generate unlimited rewards. Hinted attempts can earn reduced credit; mistakes never remove existing coins. Recognition and production rewards remain consistent with the review module's separate skill records.

A configurable reward table defines amounts, qualifying outcomes, and repeat eligibility. Exact values and eligibility rules must be specified in the implementation plan. A reward service consumes learning events and issues uniquely identified transactions, making repeated delivery or page reloads safe from duplicate payouts. Currency is not presented as a direct measurement of fluency.

The town supports Chinese-language shopping for clothing, personal items, food, and eventually furniture. Item names, descriptions, categories, shop dialogue, prices, and purchase feedback use Chinese, with pinyin and English available through the player's configured help control. Purchasing and browsing provide contextual practice with numbers, quantities, classifiers, colors, and preferences. Shops can suggest optional practice prompts, but unfamiliar language never permanently blocks a purchase or a core lesson. Vocabulary beyond the current lesson level is marked as enrichment rather than assumed mastered.

Purchases have explicit confirmation showing the item, quantity, total cost, and remaining balance. Insufficient funds leave both inventory and balance unchanged. Items have stable identifiers, a Chinese name, pinyin, English help, category, price, associated vocabulary identifiers, visual asset references, and optional equipment or placement metadata in editable catalog data. Merely buying an item records exposure, not vocabulary mastery.

An economy module owns the wallet, reward ledger, price lookup, and atomic purchase validation. An inventory module owns item quantities and equipped clothing; a later housing module owns furniture placement. Visual items reference assets by identifier so clothing, shop stock, and furnishing content can expand without modifying lesson logic. Wallet, inventory, and reward claims are saved together in a versioned profile. Local saves are suitable for a single-player prototype and are user-editable; an eventual shared economy requires server-authoritative validation.

First implementation scope adds the wallet, learning reward feedback, and one small souvenir shop with Chinese item names, a wearable cosmetic, and a personal collectible. Food shops, a broader clothing catalog, and furniture shopping with a customizable lodging room are later expansions. Food can be collected or used for optional cosmetic effects; hunger and spending are not prerequisites for learning. Furniture purchases are introduced with usable placement functionality rather than selling unusable items.

Lesson data is stored in one JSON file per lesson. A first self-introduction lesson contains dialogue such as an NPC asking the tourist's name and country. Each response declares several accepted Chinese forms, for example `我叫安娜`, `我的名字是安娜`, and `安娜`, all mapped to the same self-introduction intent. Each line can include Chinese characters, pinyin, English help text, associated vocabulary, and optional audio metadata.

NPC definitions and ambient conversations are separate data files. Adding a future NPC requires adding its definition and placing its scene entity in PlayCanvas. Adding a lesson requires creating its JSON data file and setting the NPC's lesson identifier.

## First playable slice

### Curriculum progression and quest library

Progression follows explicit vocabulary, grammar, listening, and response prerequisites rather than assigning every activity in a theme to a single HSK level. The same transport, food, or shopping location supports increasingly demanding quests. HSK is a curriculum alignment target, not a prescribed universal teaching order. Store the syllabus version, source, level mappings, and validation status separately from quest data. Official syllabus reference: https://www.chinesetest.cn/syllabus . Classic and revised HSK lists must not be silently mixed; exact word and grammar levels require verification against the selected syllabus before publication. Until then, difficulty bands below are design targets rather than certified HSK mappings.

Every quest declares prerequisite vocabulary/grammar identifiers, a small target set (normally three to five new words or one new structure), known words to recycle, supported input modes, model examples, accepted intents, help, review evidence, completion criteria, and one-time or scheduled reward eligibility. Required instructions must also fit the learner's level. Optional colloquial dialogue is enrichment with help available. A content validator flags unintroduced required language, missing translations/audio, broken prerequisites, and words without curriculum mappings. Versioned coverage reports track vocabulary and grammar taught, practiced, and reviewed; completing a district alone does not certify an entire HSK level.

The learning loop is introduce with objects and short audio, recognize, practice with support, apply in a meaningful NPC exchange, and return later through spaced review. Skill-specific evidence drives recommended next quests. Exploring locations remains available; advanced tasks can be previewed with their prerequisites. Learners can voluntarily try supported harder tasks or use a short optional placement activity. Neither coins nor repeated mistakes lock players out of core learning. An unsuccessful attempt offers a simpler prompt or demonstration while preserving progress.

#### Transport arc: a tourist's first outing

- Early beginner target: recognize two or three available vehicle types through pictures and audio, then tell a driver one destination using a short taught phrase such as 我要去学校. Use one direct trip, familiar landmarks, no transfers or timetable arithmetic, and no time pressure. Candidate language must pass syllabus mapping before an HSK level is displayed.
- Developing beginner target: choose a departure time or buy a single ticket using already introduced numbers, time expressions, and quantities. Ask one question at a time; reinforce the same transport vocabulary.
- Intermediate target: follow a short route, ask where to get off, or compare two straightforward transport options after the required direction and comparison structures are taught.
- Later intermediate target: explain a preference using cost or travel time, or respond to a simple changed plan. Multi-step disruptions and unfamiliar transport terminology are optional advanced extensions.

These bands are intended to grow across HSK 1 through HSK 4 after formal mapping. Transport complexity and language complexity are controlled independently: a visually interesting train trip can still use beginner dialogue.

#### Reusable minigames and quests

| Activity | Player goal | Initial language focus | Later extension |
| --- | --- | --- | --- |
| Pack for an outing | Select pictured items for a short packing list | Everyday nouns, recognition, small quantities | Explain choices using weather and plans |
| Breakfast order | Order a familiar drink or food and receive the matching item | Wants, food words, quantities already taught | Preferences, comparisons, substitutions |
| Souvenir errand | Find an item matching a short description | Known objects and colors | Compare gifts and negotiate a suitable price |
| Lost and found | Identify an object and return it to its owner | Possession and taught descriptions | Describe where and when it was lost |
| Photo walk | Photograph objects matching Chinese prompts around the square | Recognizing known words in a new visual context | Describe a scene or give simple directions |
| Listen and deliver | Carry an item to the person or landmark named in a short recording | Listening with one instruction at a time | Sequence two familiar instructions |
| Postcard home | Assemble or type a short message about the vacation | Introductions and familiar sentence patterns | Recount an outing and express opinions |
| Decorate your room | Place owned objects following optional Chinese prompts | Furniture names and introduced location words | Explain layout choices or follow richer descriptions |

Use these as a content roadmap, not a requirement to build every activity immediately. First expansion after the core town square adds Pack for an Outing and the early-beginner direct-trip quest; later quests depend on their corresponding world and inventory features. All activities reuse vocabulary, dialogue, review, audio, and economy services. Quest and minigame definitions remain editable data; gameplay adapters implement selection, delivery, photographing, and conversation without embedding curriculum text.

Verification covers prerequisite eligibility, recommended difficulty, small target sets, valid alternative answers, non-blocking help, and shared review/reward event handling. Curriculum review must check full sentences and task instructions, not only the featured nouns. Playtesting should confirm that beginners understand what to do without needing language the quest has not introduced.

### Market culture and bargaining

Include optional bargaining at selected clothing and souvenir stalls, inspired by the Ladies' Market in Hong Kong. The Hong Kong Tourism Board explicitly describes bargaining there: https://www.discoverhongkong.com/eng/place-to-go/travel.guide-ladies-market.html . This is inspiration for a fictional Mandarin-learning town, not a claim that all Chinese shops bargain or that Mandarin lessons reproduce local Cantonese dialogue. Cultural help notes distinguish location-specific practices from general advice. Broader cultural encounters should be grounded in their particular setting and reviewed before inclusion.

Each shop declares whether prices are fixed or negotiable. Fixed-price shops can politely explain 明码标价，不讲价 (clearly marked prices, no bargaining). The first souvenir stall allows a short negotiation initiated by the player. Browsing, walking away, and refusing an offer are always available; NPCs do not chase the player or initiate sales conversations.

Editable bargaining data contains an opening quote, a minimum acceptable price, counteroffer steps, and a maximum number of substantive negotiation rounds. These are game balance settings, not asserted real-world discount percentages. Sellers respond consistently to the offer and transaction context, never raising the minimum based on the player's wallet or language mistakes. Repeated demands do not force further discounts. Buying multiple items may qualify for a configured bundle price, validated against the applicable minimum total.

Players can politely request a discount, state a budget, make a numeric counteroffer, accept, decline, or ask for a cheaper alternative using speech, typing, or supported replies. Sample Mandarin intents include 能便宜一点吗？ (Could it be a little cheaper?), 三十可以吗？ (Would thirty work?), 我只有二十五，够吗？ (I only have twenty-five; is that enough?), and 太贵了，我再看看。 (That's too expensive; I'll look around some more.) Display 学习币 as the transaction currency, with its unit understood in contextual short offers. Accept appropriate alternate wording. If an amount or intent is ambiguous, ask for clarification without spending money or consuming a negotiation round.

A seller can accept a reasonable offer, counter, explain their final price, or recommend a cheaper item. A limited budget does not guarantee acceptance below their minimum. Communicative success and learning credit are separate from the commercial result: an understandable offer that a seller declines is still valid Chinese. Negotiation rewards follow existing duplicate-credit rules and cannot be farmed by cancelling purchases.

Agreeing on a price creates a pending quote, never an immediate debit. The existing purchase confirmation displays the agreed price, quantity, and remaining wallet balance. Revalidate funds and the quote on confirmation; cancel safely on stale or invalid quotes. The first slice supports a single-item negotiation; bundle bargaining remains a later extension. Add tests for fixed-price refusal, minimum-price boundaries, repeated requests, insufficient funds, ambiguous amounts, accepted language despite declined offers, and confirmation at the negotiated price.

The implementation is intentionally limited to:

1. One low-poly town-square scene with player movement and a follow camera.
2. Three manually placed, approachable NPCs.
3. One reusable dialogue interface and an HSK 1 self-introduction lesson.
4. Chinese-first display with a settings-controlled pinyin and English toggle.
5. Typed and selectable responses, with multiple accepted Chinese answers.
6. A speech-recognition capability check and microphone-input interface, retaining typing as the fallback.
7. One ambient background conversation, replayable and savable to a phrasebook.
8. Local progress saving.
9. One Find the Item minigame with an editable vocabulary/object set.
10. Shared word familiarity, a configurable spaced-review scheduler, and due-word indicators in the phrasebook.
11. Learning-earned 学习币, a persistent wallet and inventory, and a small Chinese-language souvenir shop with one wearable cosmetic and one personal collectible.
12. Approved natural Mandarin audio for the first-slice NPC, shop, and ambient dialogue, with consistent speaker identities, replay, slower playback, and volume controls.
13. Optional single-item bargaining at the souvenir stall, with budget statements, counteroffers, seller limits, cheaper alternatives when available, and explicit purchase confirmation.

Combat, online accounts, multiplayer, unrestricted AI chat, HSK 2 through HSK 4 content, and large streamed regions are outside this first slice. The module boundaries preserve a path to add them later.

## Data flow

The player interacts with an NPC scene entity. The NPC module resolves its lesson identifier and asks the lesson module to load that lesson. The lesson module renders each dialogue node through the language-support module. Typed, selected, or transcribed spoken responses pass through a response normalizer, then into the lesson's accepted intent matcher. A successful response updates progress and displays the next node; an unsuccessful response gives a short hint and allows another attempt. Completed nodes award vocabulary and phrasebook entries through the progress module.

Ambient entities use the same language-support renderer but never block player control or start a lesson automatically.

## Error handling

Missing NPC or lesson data produces a developer-facing diagnostic and a player-facing unavailable-conversation message. Invalid lesson nodes do not crash the scene; they close safely and preserve existing progress. Browser support and permission failures for the microphone show a non-blocking fallback message. Corrupt saved progress resets only the invalid local profile after preserving the active session when possible.

## Verification

Automated unit tests will cover response normalization, intent matching with several valid answers, language-support rendering choices, settings persistence, and progress updates. A browser smoke test will verify that the player can move, approach an NPC, complete a typed conversation, toggle help, replay ambient dialogue, and continue after declining microphone access.

Review tests use a controlled clock to verify longer intervals after successful unassisted reviews, earlier return after errors, limited credit for hints, separation of recognition and production, and persistence across reloads. Minigame checks verify that shuffled objects still map to the correct vocabulary identifiers and that an incorrect choice leads to a useful correction without losing progress.

Economy tests verify eligible learning rewards, duplicate-event protection, repeat-review eligibility, purchases without negative balances, inventory updates, and wallet/inventory consistency after reload. Browser checks cover earning coins, revealing Chinese shop help, buying and equipping the cosmetic, and receiving clear feedback for an unaffordable purchase.

Audio verification includes listening review of the actual clips, dialogue/audio content matching, stable NPC voice identity, playback after the initial player gesture, replay and pitch-preserving slower playback, ambient volume reduction during conversation, and readable fallback when audio fails to load. Automated checks can verify asset references and playback state but cannot certify that voices sound human.
