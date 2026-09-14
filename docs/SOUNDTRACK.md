# Town soundtrack

The game now plays five original, browser-synthesised compositions: Morning by the Window (soft piano), Along the River (plucked folk), Afternoon Tea (mellow jazz), Lanterns Above the Clouds (ambient), and Home at Dusk (gentle lo-fi). These are synthesised instrument approximations, not recordings or Minecraft music.

Music begins after **开始旅行**. Open **设置 → 小镇歌单** to see the current song and use **下一首** to skip. The existing music slider controls all tracks. Songs fade in over three seconds and out over five, with an 8–18 second quiet break between songs. Skip fades over 1.5 seconds. Each shuffle cycle plays all five pieces once, with no immediate repeats between cycles. Entering buildings changes environmental sound without restarting the song. Dialogue ducking and pausing in hidden tabs still apply.

## Editing and extending

Edit `src/content/music.json`. Each track has a unique `id`, Chinese and English titles/genres, `instrument`, `bpm`, `swing`, `brush`, `level`, eight `chords`, and eight `melody` bars. Pitches are semitones from middle C (0 = C4, 12 = C5); `null` is a rest. Each melody bar contains eight eighth-note slots. `swing` is the fraction of a beat before the offbeat: 0.5 is straight, 0.63 is swung. `brush: 0` removes percussion.

Available instruments: `piano`, `pluck`, `mallet`, `air`, `keys`. Keep `level` below 1. The score compiler creates a quiet opening, a fuller middle with a counterline, and a quiet reprise, followed by a release tail. For a different arrangement, edit `compileScore` in `src/core/music-playlist.js`. Instrument synthesis lives in `src/services/music-instruments.js`; playback and environmental sound live in `src/services/music.js`.

When adding tracks, update the five-song UI explanation and expected catalog counts in the playlist tests. Run `npm run verify` and `npx playwright test tests/browser/music-playlist.spec.js tests/browser/soundscape.spec.js --reporter=line`. The browser audio test renders complete scores and measures nonzero output, peak headroom and end silence; it is not a subjective listening review.
