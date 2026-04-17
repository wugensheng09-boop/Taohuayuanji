import fs from "node:fs/promises";
import path from "node:path";

// ========= 1. 角色人设与音色基准配置 =========
const VOICE_PROFILES = {
  narrator: {
    voice: "Ethan", // 旁白基础音色 (需替换为支持温润中性的声线)
    basePrompt: "音色：中性温润。情绪：平静、轻柔、带画面感。语速：中慢。关键词：陪伴、展开、留白。",
  },
  fisherman_inner: {
    voice: "Noah", // 主角心声
    basePrompt: "音色：年轻、清透、贴近耳边。情绪：好奇、惊异、犹疑、惆怅。语速：中速偏慢。语气词收敛。关键词：近、轻、真。",
  },
  fisherman_quote: {
    voice: "Noah", // 主角对白 (同源更实)
    basePrompt: "音色：年轻、清透。声音比心声要实。情绪：谨慎、礼貌、真诚。语速：中速。关键词：开口、回应、克制。",
  },
  aqiao: {
    voice: "Noah", // 阿樵
    basePrompt: "音色：朴实男声。情绪：惊讶、警觉、善意。语速：中速偏快。关键词：山野气、戒备。",
  },
  chief: {
    voice: "Eric", // 族长
    basePrompt: "音色：中老年温厚男声。情绪：沉静、感慨、平和。语速：慢。关键词：厚度、安定、隔世感。",
  },
  peer_fisher: {
    voice: "Ethan", // 同业渔人
    basePrompt: "音色：中年、烟火气、外放。情绪：热情、追问、兴奋、半信半疑。语速：中快。",
  },
};

// ========= 2. 按场景(阶段)的动态情绪曲线 =========
const SCENE_EMOTION_CURVE = {
  river: {
    stageName: "1. 溪行阶段",
    narratorExt: "旁白最重要；情绪：安静、漫游、若有若无的吸引。",
    innerExt: "极轻微的主角心声，几乎被环境音淹没。",
    allExt: "整体收束，环境音比人声更重要。",
  },
  peach_forest: {
    stageName: "2. 见桃林阶段",
    narratorExt: "旁白变得更柔、更慢，可以带着不可思议的喘息，呼吸轻微可闻。",
    innerExt: "主角心声比前面明显，被放大的惊艳与不解，好奇被拉高。",
    allExt: "惊艳、不解。",
  },
  cave_entry: {
    stageName: "3. 入洞阶段",
    narratorExt: "所有人声收一点，停顿比前面多，句尾留悬念。压低声音。",
    innerExt: "谨慎、悬念、压低声音。停顿明显。",
    allExt: "所有人声压低，悬念感拉满。",
  },
  first_view: {
    stageName: "4. 初见桃源阶段",
    narratorExt: "整体变开阔，惊异中带着放松，不敢相信眼前所见。",
    innerExt: "主角心声要更轻，仿佛怕惊扰了这方天地。",
    allExt: "惊异、放松、不敢相信。",
  },
  village_talk: {
    stageName: "5. 村中对谈",
    narratorExt: "节奏慢下来，温暖、安详的旁观者。",
    innerExt: "放松的叹息。",
    allExt: "村民第一句要打破静谧但不能太猛。族长出现后，整体节奏慢下来，充满年代感与温情。",
  },
  lost_path: {
    stageName: "6. 离开后再寻不得",
    narratorExt: "带有一丝怅然若失，结局留白，声音渐行渐远。",
    innerExt: "深深的惆怅与无奈，叹息加重。",
    allExt: "叹息、怅然、命运感。",
  },
};

// ========= 3. Qwen/Omni API 调用方法 =========
// 提示：此处默认使用标准 API 格式，你如果用 captioner 模型自行处理对应 prompt 发送。
async function synthesizeVoice(text, characterId, trackType, sceneId, apiKey) {
  const profile = VOICE_PROFILES[characterId];
  const curve = SCENE_EMOTION_CURVE[sceneId] || {};

  // 拼接 Instruct 提示词，融合人物基调与当前场景情感曲线
  let instructPrompt = profile.basePrompt;
  if (trackType === "inner" && curve.innerExt) instructPrompt += ` [场景指引: ${curve.innerExt}]`;
  else if (characterId === "narrator" && curve.narratorExt) instructPrompt += ` [场景指引: ${curve.narratorExt}]`;
  else if (curve.allExt) instructPrompt += ` [场景指引: ${curve.allExt}]`;

  console.log(`\n--- 准备生成: [${sceneId}] ${characterId} ---`);
  console.log(`>> 文本: ${text}`);
  console.log(`>> 导演指示: ${instructPrompt}`);

  const body = {
    model: process.env.BAILIAN_TTS_MODEL || "qwen3-tts-instruct-flash",
    input: {
      text: text,
      voice: profile.voice
    },
    parameters: {
      prompt: instructPrompt
    }
  };

  try {
    const res = await fetch("https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "X-DashScope-Async": "disable"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errJson = await res.text();
      console.error(`请求失败: ${res.status}`, errJson);
      return null;
    }

    const json = await res.json();
    const url = json.output?.audio?.url;
    if (!url) return null;

    // 下载音频Buffer
    const audioRes = await fetch(url);
    return await audioRes.arrayBuffer();
  } catch (err) {
    console.error("生成报错:", err.message);
    return null;
  }
}

// ========= 4. 批量主流程 =========
async function run() {
  const apiKey = process.env.BAILIAN_API_KEY;
  if (!apiKey) {
    console.error("请先在环境或 .env.local 中配置 BAILIAN_API_KEY");
    process.exit(1);
  }

  const dataPath = path.join(process.cwd(), "data", "lessons", "taohuayuanji", "scenes.json");
  const scenes = JSON.parse(await fs.readFile(dataPath, "utf8"));
  
  const OUT_DIR = path.join(process.cwd(), "public", "audio", "taohuayuanji", "voice");
  await fs.mkdir(OUT_DIR, { recursive: true });

  for (const scene of scenes) {
    for (const item of scene.timeline) {
      // 判断角色
      let characterId = "narrator";
      if (item.speakerMode === "npc") {
        characterId = item.npcId === "villager" ? "aqiao" : item.npcId; // 村民默认阿樵口吻
      } else if (item.voiceTrack === "inner") {
        characterId = "fisherman_inner";
      } else if (item.voiceTrack === "quote") {
        characterId = "fisherman_quote";
      }

      // 跳过自动配音或非必须项
      if (item.voiceTrack === "none") continue;

      const audioBuf = await synthesizeVoice(item.text, characterId, item.voiceTrack, scene.sceneId, apiKey);
      
      if (audioBuf) {
        const outPath = path.join(OUT_DIR, `${item.id}.MP3`);
        await fs.writeFile(outPath, Buffer.from(audioBuf));
        console.log(`✅ 已保存: ${outPath}`);
      }
      
      // 休眠防限流
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

run().catch(console.error);
