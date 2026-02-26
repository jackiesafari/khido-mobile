Original prompt: Alright lets work on the garden game. This time focusing on level 3. Make sure to check the code before writing the code as much as been updated since the last time you have worked on this project. Please check the logic. We want to integrate the concept of bridges for level 3. Remeber we want this game to be top notch for when it comes out in IOS.

- Reviewed current `components/IsoBoard.tsx` and `app/games.tsx` to confirm current bridge dots implementation and level logic.
- Planned update: replace midpoint dots with A/B endpoint bridge arcs, add level theme model, pass theme into IsoBoard, and keep bridge render order between tiles and labels.
- Implemented bridge endpoint model (`aCol/aRow/bCol/bRow`) and replaced midpoint dots with cubic arc bridge rendering in `IsoBoard`.
- Added bridge pillars at both endpoints, active glow styling, and dashed inactive path rendering.
- Added `IsoBoardTheme` and threaded level themes from `app/games.tsx` into `IsoBoard`.
- Added `theme` to every `PuzzleLevel` with distinct palettes, including dramatic night look for Level 3.
- Updated in-game copy from "dots" to "bridge" wording.
- Validation: `npm run lint` passes with one pre-existing warning in `app/games.tsx` (`adaptiveNudge` unused).

TODO / next suggestions:
- Verify bridge arc and pillar visual thickness on smaller iPhone screens and adjust constants if needed.
- Optionally theme the legend and icon colors based on level theme for stronger Level 3 identity.
- Follow-up polish: removed remaining hardcoded stone shade in `IsoBoard` canvas and kept all board palette inputs theme-driven.

- Added procedural garden generation with a seeded RNG in `app/games.tsx`.
- Added 10 new levels (`ADDITIONAL_LEVEL_COUNT = 10`) for a total of 13, each with randomized layout, bridge links, flower/object placement, obstacle positions, and palette selection.
- Added session seed support (`globalThis.__KHIDO_GARDEN_SEED__`) for reproducible debugging runs.
- Added silent analytics logging via `lib/garden-analytics.ts`.
- Logged events now include timestamps and JSON payloads for: level start, tile tap patterns, level restarts, level time spent, completion time, and idle periods.
- Analytics storage is modular: local JSON buffer (web localStorage + in-memory) plus best-effort API write to `/v1/game-events` when auth token exists.
- Updated `components/IsoBoard.tsx` and flat-grid styles to render procedural obstacle markers.
- Replaced sound assets and updated `app/sounds.tsx` sound sources to new files:
  - `assets/sounds/waterfall.mp3`
  - `assets/sounds/rain.mp3`
  - `assets/sounds/birds.mp3`
  - `assets/sounds/frogs.m4a`
  - `assets/sounds/general_nature.mp3`
- Added new sound category: `General Nature`.
- Sound playback remains continuous and looping (`isLooping: true`) to support sessions >= 10 minutes.
- Validation: `npm run lint` passes with no warnings/errors.

TODO / next suggestions:
- Device QA on iOS/Android to confirm seamless loop transitions for each supplied audio track.
- If native offline persistence is required (not just web localStorage + API), add AsyncStorage/SQLite sink to `garden-analytics.ts`.
