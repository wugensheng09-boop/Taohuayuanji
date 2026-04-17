from __future__ import annotations

import math
import random
import wave
from pathlib import Path

import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
IMG_DIR = ROOT / "public" / "assets" / "taohuayuanji"
VIDEO_DIR = ROOT / "public" / "videos" / "taohuayuanji"
AUDIO_DIR = ROOT / "public" / "audio" / "taohuayuanji"

W, H = 1600, 900
FPS = 12
DURATION = 6
FRAMES = FPS * DURATION


SCENES = [
    {
        "id": "cover",
        "title": "桃花源记",
        "subtitle": "课本世界穿越器 · 沉浸演示",
        "sky": ((44, 64, 103), (91, 154, 117)),
        "ground": ((26, 68, 85), (20, 45, 75)),
        "accent": (255, 208, 228),
    },
    {
        "id": "river",
        "title": "溪流行舟",
        "subtitle": "晋太元中，武陵人捕鱼为业",
        "sky": ((58, 98, 138), (96, 155, 175)),
        "ground": ((45, 95, 110), (29, 58, 77)),
        "accent": (194, 234, 255),
    },
    {
        "id": "peach_forest",
        "title": "忽逢桃花林",
        "subtitle": "芳草鲜美，落英缤纷",
        "sky": ((70, 90, 130), (228, 165, 190)),
        "ground": ((66, 113, 89), (58, 72, 82)),
        "accent": (255, 171, 205),
    },
    {
        "id": "cave_entry",
        "title": "山洞入口",
        "subtitle": "山有小口，仿佛若有光",
        "sky": ((29, 45, 72), (50, 74, 97)),
        "ground": ((37, 55, 73), (18, 30, 44)),
        "accent": (255, 227, 171),
    },
    {
        "id": "first_view",
        "title": "初入桃源",
        "subtitle": "土地平旷，屋舍俨然",
        "sky": ((100, 143, 168), (143, 189, 157)),
        "ground": ((84, 135, 105), (50, 98, 75)),
        "accent": (244, 242, 188),
    },
    {
        "id": "village_talk",
        "title": "村中见闻",
        "subtitle": "黄发垂髫，并怡然自乐",
        "sky": ((125, 151, 132), (209, 198, 148)),
        "ground": ((97, 116, 85), (63, 86, 57)),
        "accent": (255, 232, 175),
    },
    {
        "id": "lost_path",
        "title": "离开后再寻不得",
        "subtitle": "遂迷，不复得路",
        "sky": ((70, 78, 98), (112, 116, 132)),
        "ground": ((61, 73, 87), (33, 39, 52)),
        "accent": (209, 220, 238),
    },
]


def lerp(a: int, b: int, t: float) -> int:
    return int(a + (b - a) * t)


def draw_vertical_gradient(img: Image.Image, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> None:
    draw = ImageDraw.Draw(img)
    for y in range(H):
        t = y / (H - 1)
        color = (lerp(top[0], bottom[0], t), lerp(top[1], bottom[1], t), lerp(top[2], bottom[2], t))
        draw.line([(0, y), (W, y)], fill=color)


def draw_landscape(spec: dict) -> Image.Image:
    img = Image.new("RGB", (W, H), (0, 0, 0))
    draw_vertical_gradient(img, spec["sky"][0], spec["sky"][1])
    img = img.convert("RGBA")
    draw = ImageDraw.Draw(img, "RGBA")

    random.seed(spec["id"])
    for i in range(3):
        base_y = 460 + i * 70
        color = (
            max(spec["ground"][0][0] - i * 12, 0),
            max(spec["ground"][0][1] - i * 12, 0),
            max(spec["ground"][0][2] - i * 10, 0),
            180 - i * 25,
        )
        points = [(0, H)]
        x = 0
        while x <= W:
            wobble = math.sin((x / W) * math.pi * (1.7 + i * 0.8) + i * 0.6) * (45 + i * 15)
            points.append((x, int(base_y + wobble)))
            x += 60
        points.extend([(W, H), (0, H)])
        draw.polygon(points, fill=color)

    river = [
        (W * 0.08, H * 0.95),
        (W * 0.28, H * 0.75),
        (W * 0.52, H * 0.62),
        (W * 0.72, H * 0.45),
        (W * 0.94, H * 0.2),
    ]
    draw.line(river, fill=(180, 220, 255, 165), width=110)
    draw.line(river, fill=(220, 240, 255, 220), width=52)

    if spec["id"] == "peach_forest":
        for _ in range(90):
            x = random.randint(80, W - 80)
            y = random.randint(150, H - 160)
            r = random.randint(3, 8)
            shade = random.randint(-18, 18)
            col = (255, max(145 + shade, 120), max(185 + shade, 150), 210)
            draw.ellipse((x - r, y - r, x + r, y + r), fill=col)

    if spec["id"] == "cave_entry":
        cave = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        cave_draw = ImageDraw.Draw(cave, "RGBA")
        cave_draw.ellipse((560, 240, 1120, 860), fill=(12, 18, 29, 230))
        cave_draw.ellipse((690, 350, 990, 760), fill=(255, 215, 150, 95))
        cave = cave.filter(ImageFilter.GaussianBlur(2))
        img.alpha_composite(cave.convert("RGBA"))

    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    overlay_draw = ImageDraw.Draw(overlay, "RGBA")
    overlay_draw.rectangle((0, 0, W, H), fill=(0, 0, 0, 38))
    img.alpha_composite(overlay)

    title_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    title_draw = ImageDraw.Draw(title_layer, "RGBA")
    title_draw.rounded_rectangle((240, 640, 1360, 830), radius=30, fill=(15, 23, 42, 130))
    title_draw.text((300, 690), spec["title"], fill=(248, 250, 252, 240))
    title_draw.text((300, 745), spec["subtitle"], fill=(226, 232, 240, 230))
    img.alpha_composite(title_layer)

    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    g = ImageDraw.Draw(glow, "RGBA")
    g.ellipse((W - 360, 70, W - 70, 360), fill=(*spec["accent"], 110))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(20)))

    return img.convert("RGB")


def make_scene_video(image_path: Path, video_path: Path, scene_id: str) -> None:
    base = Image.open(image_path).convert("RGB")
    writer = imageio.get_writer(video_path, fps=FPS, quality=8, macro_block_size=1)

    random.seed(scene_id)
    petals = []
    if scene_id == "peach_forest":
        for _ in range(24):
            petals.append(
                {
                    "x": random.uniform(0, W),
                    "y": random.uniform(-H * 0.5, H),
                    "speed": random.uniform(1.6, 3.3),
                    "drift": random.uniform(-0.7, 0.7),
                    "r": random.randint(3, 6),
                }
            )

    for i in range(FRAMES):
        t = i / (FRAMES - 1)
        zoom = 1.0 + 0.06 * t
        crop_w = int(W / zoom)
        crop_h = int(H / zoom)
        dx = int(math.sin(t * math.pi * 2) * 14)
        dy = int(math.cos(t * math.pi * 1.5) * 10)
        left = (W - crop_w) // 2 + dx
        top = (H - crop_h) // 2 + dy
        frame = base.crop((left, top, left + crop_w, top + crop_h)).resize((W, H), Image.Resampling.LANCZOS)

        if petals:
            d = ImageDraw.Draw(frame, "RGBA")
            for p in petals:
                p["x"] += p["drift"]
                p["y"] += p["speed"]
                if p["y"] > H + 20:
                    p["y"] = random.uniform(-120, -20)
                    p["x"] = random.uniform(0, W)
                x, y, r = p["x"], p["y"], p["r"]
                d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 183, 211, 180))

        if scene_id == "cave_entry":
            d = ImageDraw.Draw(frame, "RGBA")
            pulse = int(120 + 70 * math.sin(i * 0.28))
            d.ellipse((720, 365, 950, 650), fill=(255, 214, 150, pulse))

        writer.append_data(np.asarray(frame))

    writer.close()


def write_wave(path: Path, generator: str, duration: int = 26, sample_rate: int = 22050) -> None:
    n = duration * sample_rate
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)

        frames = bytearray()
        for i in range(n):
            t = i / sample_rate
            if generator == "stream":
                val = (
                    0.35 * math.sin(2 * math.pi * 130 * t)
                    + 0.22 * math.sin(2 * math.pi * 190 * t + 0.5)
                    + 0.08 * math.sin(2 * math.pi * 420 * t)
                )
            elif generator == "forest":
                val = (
                    0.28 * math.sin(2 * math.pi * 230 * t)
                    + 0.18 * math.sin(2 * math.pi * 310 * t + 1.2)
                    + 0.1 * math.sin(2 * math.pi * 520 * t + 0.8)
                )
            elif generator == "cave":
                val = (
                    0.3 * math.sin(2 * math.pi * 90 * t)
                    + 0.24 * math.sin(2 * math.pi * 130 * t + 0.3)
                    + 0.08 * math.sin(2 * math.pi * 35 * t)
                )
            elif generator == "village":
                val = (
                    0.26 * math.sin(2 * math.pi * 175 * t)
                    + 0.2 * math.sin(2 * math.pi * 240 * t + 0.4)
                    + 0.1 * math.sin(2 * math.pi * 420 * t + 0.9)
                )
            else:
                val = (
                    0.24 * math.sin(2 * math.pi * 110 * t)
                    + 0.14 * math.sin(2 * math.pi * 172 * t + 0.5)
                    + 0.08 * math.sin(2 * math.pi * 260 * t + 0.4)
                )

            env = 0.9 + 0.1 * math.sin(2 * math.pi * t / 9)
            sample = max(-1.0, min(1.0, val * env))
            v = int(sample * 16000)
            frames.extend(int(v).to_bytes(2, "little", signed=True))

        wav.writeframes(frames)


def main() -> None:
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    print("Generating images...")
    for spec in SCENES:
        img = draw_landscape(spec)
        img.save(IMG_DIR / f"{spec['id']}.png", quality=95)

    print("Generating scene videos...")
    for spec in SCENES:
        if spec["id"] == "cover":
            continue
        make_scene_video(
            IMG_DIR / f"{spec['id']}.png",
            VIDEO_DIR / f"{spec['id']}.mp4",
            spec["id"],
        )

    print("Generating ambient audio...")
    write_wave(AUDIO_DIR / "stream.wav", "stream")
    write_wave(AUDIO_DIR / "peach_forest.wav", "forest")
    write_wave(AUDIO_DIR / "cave.wav", "cave")
    write_wave(AUDIO_DIR / "village.wav", "village")
    write_wave(AUDIO_DIR / "lost_path.wav", "ending")

    print("Done.")


if __name__ == "__main__":
    main()
