Original prompt: 将《桃花源记》单画面沉浸版升级为对话驱动剧情推进，并加入竹简/行旅札记/见闻录视觉、古风场景切换按钮与镜头调度感。

## Progress Notes
- 已扩展场景类型与互动字段：lineType/interactionId/maxGuideTurns/expectedIntents/fallbackAdvance。
- 已重写 AI 层与 prompt 组装，支持 mode=story_interaction|free_ask 与 shouldAdvance/nextPrompt 返回。
- 已改造会话统计：interactionAttempts/guidedAdvances/lineProgress。
- 已重写 LearningWorkspace 为单画面剧情互动版，并加入任务行卷、行旅札记、见闻录浮层。
- 已补齐镜头调度 CSS：推近、聚焦、明暗、人物强调、拉远。
- 已将 lesson/npcs/knowledge/scenes 四份 JSON 统一为可读中文并补齐 6 场景互动脚本。

## TODO / Next Agent Handoff
- 运行 lint/build 后根据报错微调类型与细节。
- 如需更强“剧情角色感”，可为每个互动节点补充更精细 expectedIntents。
- 如需更电影化，可按场景增加 overlay 粒度（如景深遮罩层随时间变化）。

## Verification
- npm run lint: PASS
- npm run build: PASS
- Build includes new API and full-screen learn route.

## Notes
- 当前版本保持“自动叙事 + 互动节点”混合推进；场景结尾有古风按钮并默认自动前行。
- 互动节点支持“回应剧情/跳过本轮”，满足演示稳定性。
- Re-ran verification after validator tightening:
  - npm run lint: PASS
  - npm run build: PASS

## V3 Media Integration (latest)
- Renamed all user-provided image/video assets to stable english short names.
- Added new scene `return_mark` between `village_talk` and `lost_path`.
- Extended scene config/type: videoMode, videoFallbackImage, ambientLayers, lineBackgroundOverrides.
- River scene now supports line-level image switching (fishing -> river boat).
- Implemented video policy: play once then fallback image; ambience pauses during one-shot video and fades back in after video.
- Implemented layered ambience playback (primary + secondary), including scene-transition fade-out.
- Added optional per-line voice playback: /audio/taohuayuanji/voice/{lineId}.mp3 with wav fallback.
- Created voice directory: public/audio/taohuayuanji/voice.
- Updated lesson scene order and README to reflect V3 behavior.

## Verification (V3)
- npm run lint: PASS
- npm run build: PASS

## NPC2.0 Insert Refactor (latest)
- Replaced the old epilogue panel flow with in-timeline NPC2.0 insertion at three locked nodes:
  - `first_view:view_i1` -> `aqiao_gate`
  - `village_talk:village_i1` -> `chief_dialogue`
  - `lost_path:ending_i1` -> `peer_fisher_chain`
- Removed legacy checkpoint/interactive question payloads from `scenes.json` (quickReplies/checkpointChoices/interactionId/etc).
- Converted non-key old interactions to pure auto narrative lines.
- Added scene-level fields on timeline lines: `interactionMode` (`none|npc2`) and `interactionKey`.
- Rewrote `LearningWorkspace` runtime:
  - Story playback remains continuous.
  - NPC overlays are injected only when hitting `interactionMode=npc2` lines.
  - Peer fisherman chain now does leak eval -> 6 mixed quiz -> level-only feedback + narrative branch.
- Restored media runtime in `LearningWorkspace`:
  - Scene video + `play_once_then_image` fallback.
  - Layered ambience + BGM playback with fade.
  - Voice-over per line with `lineVoiceOverrides` and `.mp3/.MP3/.wav/.WAV` fallback probing.
  - Mix strategy for one-shot video ducking and voice ducking.
- Updated `/api/chat` to support epilogue NPC ids by mapping epilogue npc config to runtime `NpcConfig` fallback.
- Removed system-exposed copy such as playback/interaction phase labels from UI.

## Verification (NPC2.0)
- npm run lint: PASS
- npm run build: PASS
- NPC2.1: added voice-gated line progression in `LearningWorkspace` so timeline advance waits for voice completion (or fallback estimate when voice missing), eliminating half-line cutoffs.
- NPC2.1: switched NPC interaction presentation from full-screen panel to bottom dialogue box with left/right speaking rails and per-turn portrait anchors.
- Added optional `dialogSide` to `PostStoryNpcConfig` for future side override (default left for NPC, right for player).
- Re-verified:
  - npm run lint: PASS
  - npm run build: PASS
- Rhythm tuning pass:
  - `VOICE_MIN_GAP_MS`: 220 -> 320
  - `TYPE_CHAR_BASE_MS`: 46, `TYPE_PUNCT_DELAY_MS`: 140
  - fallback narration estimate: min/max/per-char -> 2200/12000/195ms
  - `VOICE_PENDING_TIMEOUT_MS`: 4200
  - scene jump auto wait: 5600 -> 6800
- Re-verified:
  - npm run lint: PASS
  - npm run build: PASS

## BGM Theme Pass
- Added procedural original BGM generator: `scripts/generate-taohuayuan-bgm.mjs`.
- Generated loopable theme file: `public/audio/taohuayuanji/bgm/ruhua-wenyou-main-theme.wav` (53.333s, 44.1kHz stereo WAV).
- Routed all seven Taohuayuanji learning scenes to the new BGM with scene-specific low volumes.
- Replaced guqin-as-ambience in `first_view` and `village_talk` with environmental layers to avoid stacked melodies.
- Verification:
  - npm run lint: PASS
  - npm run test:interrogation: PASS
  - npm run test:peer-scoring: PASS
  - npm run build: PASS
  - Playwright confirmed `/learn/taohuayuanji` requests `ruhua-wenyou-main-theme.wav` after starting the scene on port 3006.

## Art Direction Pass (latest)
- Added scene-level visual tones in `LearningWorkspace` so river, peach forest, cave, village, return path, and mist scenes get distinct grading/foreground treatment without changing story data.
- Reworked the main narration caption into a tighter cinematic subtitle panel with subtle paper grain and tone-aware borders.
- Replaced ad-hoc NPC display with a reusable stage portrait treatment: edge light, ink wash backing, bottom fade, and a floating nameplate.
- Added mobile NPC portrait chips so dialogue keeps character presence on narrow screens.
- Masked the visible black artifact in the Aqiao portrait source by fading the lower portrait into a stage shadow.

## Verification (Art Direction)
- npm run lint: PASS with existing warning: `buildCharTimingsMs` is unused in `LearningWorkspace`.
- npm run build: PASS.
- Playwright/Chrome visual checks:
  - `output/playwright/art-scene-start.png`
  - `output/playwright/art-npc-dialogue-final.png`
  - `output/playwright/art-mobile-start.png`

## Peer Fisher Portrait Fix (latest)
- Fixed the peer fisher interaction so `/assets/taohuayuanji/同业渔民询问.png` is used only as the full-screen event illustration.
- Skipped the `.npc-stage` portrait and mobile `.mobile-portrait` chip for `peer_fisher`, preventing duplicate character rendering.
- Added peer-specific dialogue shell/panel sizing so the bottom dialogue stays readable without covering the main face area.
- Re-verified:
  - npm run lint: PASS with existing `buildCharTimingsMs` warning.
  - npm run build: PASS.
  - Browser DOM/console health: PASS; in-app screenshot capture timed out, so visual evidence was captured with system Chrome Playwright.
  - Desktop/mobile screenshots saved under `%TEMP%/codex-peer-fisher-art-fix`.

## Peer Fisher Scoring Fix (latest)
- Root cause: closing the peer fisher interaction called `clearNpcState()`, which reset `leakScore`, `finalLevel`, and `finalNarrative` before the final summary page rendered. The summary then showed the old lightweight `100 - leakScore * 10` value, which collapsed back to 100 after reset.
- Added a persistent `finalScore` state and preserve peer results when leaving `peer_done`; transient dialogue state is still cleared.
- Summary stats now show `最终分数` from the actual peer-fisher final scoring formula instead of a separate ad-hoc display formula.
- Extracted peer fisher scoring to `src/lib/peerFisherScoring.mjs` and added `tests/peer-fisher-scoring.test.mjs` to lock divergent outcomes:
  - guarded A/A route: 89, 甲
  - mixed C/B route: 58, 丙
  - leaky B/C route: 15, 待提升
- Re-verified:
  - npm run test:peer-scoring: PASS
  - npm run test:interrogation: PASS
  - npm run lint: PASS with existing `buildCharTimingsMs` warning.
  - npm run build: PASS.
- Browser note: the develop-web-game Playwright client could not run because its script could not resolve a local `playwright` package; a direct Playwright attempt reached the game but full story traversal exceeded the 120s tool limit due narration/voice gating.

## NPC Dialogue Layout and Pace Fix (latest)
- Fixed the clipped NPC nameplate by allowing `.dialogue-stage-panel` overflow to stay visible and adding top padding so the badge does not collide with speech text.
- Hid the main `story-caption` whenever an NPC interaction is active, removing the extra small dialogue box behind the large NPC panel in the sixth scene and other NPC scenes.
- Reduced the perceived wait after peer fisher API replies:
  - leak evaluation starts in parallel with the roleplay reply request.
  - the next peer-fisher prompt is rendered immediately after the NPC reply is added.
  - input/options remain disabled until the leak score finishes updating, preserving final scoring correctness.
- Re-verified:
  - npm run lint: PASS with existing `buildCharTimingsMs` warning.
  - npm run build: PASS.
  - npm run test:peer-scoring: PASS.

## Animation Replacement and Entry Transition (latest)
- Copied the rebuilt videos from `C:\Users\Administrator\Desktop\重做动画` into `public/videos/taohuayuanji`.
- Added stable video paths for the post-start entry transition and village banquet one-shot animation.
- Updated `LearningWorkspace` so the cover video still gates the start button, clicking start plays `entry-transition.mp4`, and the first scene begins only after that transition ends.
- Added one-shot scene-video gating so narrative auto-advance, checkpoint/NPC injection, and space skipping wait for `play_once_then_image` video completion.
- Added `village_talk` banquet animation playback before falling back to the existing `village-banquet.png`.
- Verification:
  - npm run lint: PASS.
  - npm run build: PASS.
  - System Chrome Playwright desktop flow: PASS for cover -> start button -> entry transition -> river, cave one-shot gate, first-view one-shot gate, Aqiao interaction, village banquet one-shot gate, and banquet PNG fallback.
  - System Chrome Playwright mobile flow: PASS for cover -> start button -> entry transition -> river, including space not bypassing the entry transition.
  - Screenshots saved in `output/playwright/animation-replacement`.

## Peach Forest Long Video Rhythm Fix (latest)
- Changed `peach_forest` video mode from loop to `play_once_then_image`, so `s02_peach_forest_intro_v2.mp4` must finish before the story can advance to the cave scene.
- Removed the `river-wide.png` hold from the river scene by keeping all river timeline backgrounds on `river-fishing.png`, letting the long peach forest animation carry the wider travel transition instead.
- Verification:
  - npm run lint: PASS.
  - npm run build: PASS.
  - Production `next start` on port 3012 confirmed API config returns `peach_forest.videoMode = play_once_then_image` and river backgrounds use `river-fishing.png`.
  - System Chrome Playwright confirmed space does not bypass `s02_peach_forest_intro_v2.mp4`, the scene does not enter cave before the video ends, and the video falls back to `peach-forest.png`.
  - Screenshots saved in `output/playwright/peach-forest-video-gate`.

## One-shot Video Voice Parallel Fix (latest)
- Split one-shot video gating so ordinary auto narration can continue while a long `play_once_then_image` video is still playing.
- The video now blocks only scene exits and deferred interaction/checkpoint popups, keeping `peach_forest` voice lines moving during `s02_peach_forest_intro_v2.mp4`.
- Verification so far:
  - npm run lint: PASS.
  - npm run build: PASS.
  - Restarted local services so both `http://localhost:3000/api/lessons/taohuayuanji` and `http://localhost:3012/api/lessons/taohuayuanji` return `peach_forest.videoMode = play_once_then_image` and river uses `river-fishing.png`.
  - develop-web-game bundled Playwright client still cannot resolve the workspace `playwright` package from its skill directory, so verification used the project's local Playwright package with Chrome.
  - Playwright confirmed `forest_l1`, `forest_i1`, `forest_i2`, and `forest_l4` audio starts while `s02_peach_forest_intro_v2.mp4` is still playing, and the cave transition is blocked until the peach video ends.
  - Playwright confirmed `cave_l4` audio starts while `s03_enter_cave_v3.mp4` is still playing, with no premature jump button.
  - Playwright confirmed `view_l1` and `view_i1` audio starts while `s04_after_cave.mp4` is still playing, with the Aqiao interaction opening only after the video ends.
  - Playwright confirmed `village_l1` and `village_i1` audio starts while `village-banquet.mp4` is still playing, with the chief interaction opening only after the video ends.
  - Screenshots and media-event logs saved in `output/playwright/one-shot-voice-parallel`.

## S02 Early Start and BGM Sync Fix (latest)
- Copied `C:\Users\Administrator\Desktop\重做动画\6月23日.mp3` to `public/audio/taohuayuanji/bgm/june23-main-theme.mp3` and pointed all Taohuayuan scene BGM to it.
- Muted the post-start `entry-transition.mp4` video audio and allowed the new BGM to begin during the entry transition, with ambient layers kept silent until the first scene starts.
- Configured `s02_peach_forest_intro_v2.mp4` to begin at `river_i2` (`缘溪行，忘路之远近。`) and continue across the river -> peach forest transition without resetting.
- Added `videoBlockSceneExit: false` for the river scene so the early-start S02 video does not trap the player at the river ending; peach forest still waits for S02 completion before moving to the cave.
- Verification:
  - npm run lint: PASS.
  - npm run build: PASS.
  - Restarted local services; both 3000 and 3012 report river S02 start at `river_i2`, `videoBlockSceneExit = false`, and BGM `/audio/taohuayuanji/bgm/june23-main-theme.mp3`.
  - Playwright confirmed entry transition video is muted while the new BGM starts, S02 is absent at river start, appears at `river_i2`, river exit is available while S02 plays, and S02 continues into peach forest without resetting.
  - Screenshots and media-event logs saved in `output/playwright/s02-river-i2-bgm-sync`.
