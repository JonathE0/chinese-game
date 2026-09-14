# Calm town soundtrack

Replace the single loop with five original browser-synthesised compositions: soft piano, plucked folk, mellow jazz, spacious ambient, and light lo-fi. Minecraft is a reference for pacing and calm, not source material. Each composition has its own harmony, melody, tempo, instrument envelope and arrangement. Tracks last roughly one to two minutes, fade in/out, and leave 8–18 seconds of quiet between them.

Keep compositions and player-facing labels in editable `src/content/music.json`. A pure playlist clock uses audio time, shuffles every track once per cycle, avoids consecutive repeats across cycles, and supports a softly fading skip. Location changes keep the current song while updating environmental sound. Volume and dialogue ducking stay independent of the song envelope.

Settings show the current song, the available playlist and a next-track button. Dispose listeners when the panel closes. No external music service, audio download, or new permission is needed.

Implementation: test shuffle/boundaries/quiet gaps first; add content and clock; replace the music scheduler and introduce instrument voices; add settings controls; run unit/content/build checks and focused browser soundscape/playback checks. Verify rendered audio is non-silent and not clipped. Preserve existing sound effects, suspension and save settings. Do not commit.
