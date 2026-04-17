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
