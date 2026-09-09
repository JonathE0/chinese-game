# Mandarin Town Square: First Playable Area

## Purpose

Create a browser-based, low-poly 3D Mandarin learning game. The player is a tourist visiting a Chinese town square. They choose whom to approach; NPCs do not initiate required conversations. The first release teaches an HSK 1 self-introduction lesson and establishes reusable systems for future HSK 1 through HSK 4 areas.

## Player experience

The player explores a compact, cute low-poly town square using keyboard controls. Chinese characters are the default language display. A setting lets the player enable pinyin and English support whenever they need it.

Three approachable NPCs occupy clear locations in the square. Interacting with an NPC opens a short dialogue. The player responds by typing Chinese, selecting a prepared response, or using the microphone when browser speech recognition is available. The same dialogue works with every input method.

Background NPC pairs play short, non-blocking ambient conversations. Their Chinese speech bubbles enrich the setting and can be replayed or saved to the player's phrasebook.

## Technical architecture

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

Uses browser speech recognition configured for Mandarin when supported and permitted. It sends a recognized transcript to the lesson module using the same pathway as typed text. The UI keeps typing and selectable responses available at all times. If speech recognition is unavailable, denied, fails, or returns no result, the player receives a plain-language message and continues without losing their dialogue state.

### Progress module

Stores completed lesson nodes, collected vocabulary, phrasebook entries, unlocked interactions, and support settings in browser local storage. It validates loaded data and falls back to a new profile if stored data is invalid.

## Content model

Lesson data is stored in one JSON file per lesson. A first self-introduction lesson contains dialogue such as an NPC asking the tourist's name and country. Each response declares several accepted Chinese forms, for example `我叫安娜`, `我的名字是安娜`, and `安娜`, all mapped to the same self-introduction intent. Each line can include Chinese characters, pinyin, English help text, associated vocabulary, and optional audio metadata.

NPC definitions and ambient conversations are separate data files. Adding a future NPC requires adding its definition and placing its scene entity in PlayCanvas. Adding a lesson requires creating its JSON data file and setting the NPC's lesson identifier.

## First playable slice

The implementation is intentionally limited to:

1. One low-poly town-square scene with player movement and a follow camera.
2. Three manually placed, approachable NPCs.
3. One reusable dialogue interface and an HSK 1 self-introduction lesson.
4. Chinese-first display with a settings-controlled pinyin and English toggle.
5. Typed and selectable responses, with multiple accepted Chinese answers.
6. A speech-recognition capability check and microphone-input interface, retaining typing as the fallback.
7. One ambient background conversation, replayable and savable to a phrasebook.
8. Local progress saving.

Combat, online accounts, multiplayer, unrestricted AI chat, HSK 2 through HSK 4 content, and large streamed regions are outside this first slice. The module boundaries preserve a path to add them later.

## Data flow

The player interacts with an NPC scene entity. The NPC module resolves its lesson identifier and asks the lesson module to load that lesson. The lesson module renders each dialogue node through the language-support module. Typed, selected, or transcribed spoken responses pass through a response normalizer, then into the lesson's accepted intent matcher. A successful response updates progress and displays the next node; an unsuccessful response gives a short hint and allows another attempt. Completed nodes award vocabulary and phrasebook entries through the progress module.

Ambient entities use the same language-support renderer but never block player control or start a lesson automatically.

## Error handling

Missing NPC or lesson data produces a developer-facing diagnostic and a player-facing unavailable-conversation message. Invalid lesson nodes do not crash the scene; they close safely and preserve existing progress. Browser support and permission failures for the microphone show a non-blocking fallback message. Corrupt saved progress resets only the invalid local profile after preserving the active session when possible.

## Verification

Automated unit tests will cover response normalization, intent matching with several valid answers, language-support rendering choices, settings persistence, and progress updates. A browser smoke test will verify that the player can move, approach an NPC, complete a typed conversation, toggle help, replay ambient dialogue, and continue after declining microphone access.
