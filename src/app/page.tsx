import Image from "next/image";
import Link from "next/link";
import { type CSSProperties } from "react";

const PETAL_ITEMS = [
  { left: "8%", delay: "0s", duration: "13.5s", drift: "-28px" },
  { left: "17%", delay: "1.3s", duration: "12.8s", drift: "22px" },
  { left: "26%", delay: "2.1s", duration: "14.2s", drift: "-18px" },
  { left: "38%", delay: "0.7s", duration: "12.4s", drift: "28px" },
  { left: "49%", delay: "2.8s", duration: "13.9s", drift: "-26px" },
  { left: "61%", delay: "1.9s", duration: "13.1s", drift: "20px" },
  { left: "73%", delay: "0.5s", duration: "12.7s", drift: "-22px" },
  { left: "86%", delay: "2.4s", duration: "14.4s", drift: "24px" },
];

const JOURNEY_STEPS = ["溪流行舟", "桃花林", "山洞入口", "初入桃源"];

const DEMO_WALL_ITEMS = [
  {
    id: "taohuayuanji",
    title: "《桃花源记》",
    subtitle: "沿溪而行，入洞见村",
    href: "/learn/taohuayuanji",
    enabled: true,
  },
  {
    id: "yueyanglouji",
    title: "《岳阳楼记》",
    subtitle: "登楼远眺，忧乐之辨",
    enabled: false,
  },
  {
    id: "xiaoshitanki",
    title: "《小石潭记》",
    subtitle: "闻水探石，幽境入心",
    enabled: false,
  },
  {
    id: "zuiwengtingji",
    title: "《醉翁亭记》",
    subtitle: "山水宴游，意在其间",
    enabled: false,
  },
];

export default function Home() {
  return (
    <main className="home-body-font relative h-screen w-screen overflow-hidden text-[#2a2018]">
      <div className="absolute inset-0">
        <Image
          src="/assets/taohuayuanji/cover.png"
          alt="桃花源记场景封面"
          fill
          priority
          sizes="100vw"
          className="object-cover home-hero-zoom"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,239,212,0.48),transparent_42%),linear-gradient(110deg,rgba(255,251,243,0.72)_8%,rgba(255,244,223,0.38)_45%,rgba(24,18,12,0.5)_100%)]" />
      </div>

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {PETAL_ITEMS.map((item, index) => (
          <span
            key={`home-petal-${index}`}
            className="home-petal"
            style={
              {
                left: item.left,
                animationDelay: item.delay,
                animationDuration: item.duration,
                "--home-petal-drift": item.drift,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <section className="relative z-10 flex h-full flex-col justify-between px-6 py-7 md:px-12 md:py-10">
        <div className="grid items-start gap-8 md:grid-cols-[1.1fr_auto] md:gap-10">
          <article className="home-fade-up max-w-3xl">
            <p className="inline-flex rounded-full border border-[#b77447]/35 bg-[#fff8ec]/66 px-3 py-1 text-xs font-semibold tracking-[0.16em] text-[#8f4f24] backdrop-blur-sm">
              本地单机沉浸演示
            </p>
            <h1 className="home-title-font mt-5 text-5xl leading-[1.08] text-[#1d150e] drop-shadow-[0_8px_28px_rgba(40,24,12,0.22)] md:text-7xl">
              课本世界穿越器
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-[#3d2e21] md:text-xl">
              走进《桃花源记》，在场景、人物与提问中理解课文
            </p>
            <div className="home-fade-up home-fade-delay-2 mt-9 flex flex-wrap gap-3">
              <Link
                href="/learn/taohuayuanji"
                className="rounded-2xl border border-[#c2753d]/55 bg-[#b9642e]/92 px-6 py-3 text-sm font-semibold text-[#fff9f1] shadow-[0_14px_28px_rgba(110,55,20,0.32)] transition hover:-translate-y-0.5 hover:bg-[#a85826] md:text-base"
              >
                进入桃花源
              </Link>
              <Link
                href="/lesson/taohuayuanji"
                className="rounded-2xl border border-[#c88e5f]/45 bg-[#fffaf0]/52 px-6 py-3 text-sm font-semibold text-[#704123] shadow-[0_10px_24px_rgba(72,41,19,0.16)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-[#fff7e5]/70 md:text-base"
              >
                了解玩法
              </Link>
            </div>
          </article>

          <div className="w-full max-w-sm space-y-4">
            <aside className="home-fade-up home-fade-delay-3 rounded-[30px] border border-[#f5dfc5]/56 bg-[#fff9f1]/44 p-5 text-[#3f2b1f] shadow-[0_14px_40px_rgba(61,36,19,0.22)] backdrop-blur-xl">
              <p className="text-xs tracking-[0.2em] text-[#8f5e3d]">课文样板</p>
              <h2 className="home-title-font mt-2 text-3xl text-[#22170f]">《桃花源记》</h2>
              <p className="mt-3 text-sm leading-7 text-[#5e422f]">沿溪而行，忽逢桃林，入洞见村，再寻不得。</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-[#cf8a56]/45 bg-[#fff3e6]/66 px-2.5 py-1 text-xs text-[#8a4d23]">
                  自动叙事
                </span>
                <span className="rounded-full border border-[#cf8a56]/45 bg-[#fff3e6]/66 px-2.5 py-1 text-xs text-[#8a4d23]">
                  剧情互动
                </span>
                <span className="rounded-full border border-[#cf8a56]/45 bg-[#fff3e6]/66 px-2.5 py-1 text-xs text-[#8a4d23]">
                  画内总结
                </span>
              </div>
            </aside>

            <section className="home-fade-up home-fade-delay-4 rounded-[26px] border border-[#f5dfc5]/50 bg-[#fff9f1]/36 p-4 text-[#3f2b1f] shadow-[0_14px_34px_rgba(61,36,19,0.2)] backdrop-blur-xl">
              <p className="text-xs tracking-[0.2em] text-[#8f5e3d]">演示态项目墙</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {DEMO_WALL_ITEMS.map((item) =>
                  item.enabled ? (
                    <Link
                      key={item.id}
                      href={item.href ?? "/"}
                      className="group cursor-pointer rounded-2xl border border-[#d8b48a]/55 bg-[#fff6e9]/58 px-3 py-3 text-left shadow-[0_8px_20px_rgba(98,56,25,0.14)] transition hover:-translate-y-0.5 hover:border-[#d88f58] hover:bg-[#fff5e1]/82 hover:shadow-[0_12px_24px_rgba(110,58,24,0.2)]"
                    >
                      <p className="home-title-font text-base text-[#2f2015]">{item.title}</p>
                      <p className="mt-1 text-xs text-[#714a31]">{item.subtitle}</p>
                    </Link>
                  ) : (
                    <button
                      key={item.id}
                      type="button"
                      className="group cursor-pointer rounded-2xl border border-[#d8b48a]/55 bg-[#fff6e9]/52 px-3 py-3 text-left shadow-[0_8px_20px_rgba(98,56,25,0.11)] transition hover:-translate-y-0.5 hover:border-[#d88f58]/85 hover:bg-[#fff5e1]/72 hover:shadow-[0_12px_24px_rgba(110,58,24,0.16)]"
                    >
                      <p className="home-title-font text-base text-[#2f2015]">{item.title}</p>
                      <p className="mt-1 text-xs text-[#714a31]">{item.subtitle}</p>
                    </button>
                  ),
                )}
              </div>
            </section>
          </div>
        </div>

        <nav className="home-fade-up home-fade-delay-4 rounded-[24px] border border-[#f4dcc1]/52 bg-[#fff8ee]/38 px-4 py-3 shadow-[0_12px_32px_rgba(65,38,20,0.2)] backdrop-blur-lg">
          <p className="mb-2 text-[11px] tracking-[0.22em] text-[#9a6a44]">旅程导航</p>
          <ol className="grid gap-2 text-sm text-[#503524] sm:grid-cols-2 md:grid-cols-4">
            {JOURNEY_STEPS.map((step, index) => (
              <li
                key={step}
                className="rounded-xl border border-[#e6c8a5]/38 bg-[#fffdf8]/45 px-3 py-2 text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]"
              >
                <span className="mr-1 text-[#b6733d]">{index + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </nav>
      </section>
    </main>
  );
}
