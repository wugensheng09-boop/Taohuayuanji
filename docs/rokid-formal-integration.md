# Rokid MAX Pro Enterprise 正式嵌入方案

本项目的正式嵌入采用 `CUSTOMAPP + WebView APK`：

- Web 游戏继续作为 Next.js 线上服务运行。
- Rokid 眼镜端安装 `glass-webview` APK，全屏 WebView 加载游戏。
- 手机端安装 `mobile-controller` APK，集成 Rokid CXR-L SDK，负责授权、连接、上传安装、启动眼镜端 APK，并发送游戏控制指令。

## 目录

```text
rokid/android/
  glass-webview/       # 眼镜端 APK
  mobile-controller/   # 手机端 CXR-L 控制 APK
```

## Web 端入口

眼镜端 WebView 会加载：

```text
https://your-domain.com/learn/taohuayuanji?device=rokid&autostart=1
```

`device=rokid` 会启用眼镜模式样式和命令通道，`autostart=1` 会跳过普通 Web 首页式的序幕按钮，直接进入学习体验。

Web 端已提供：

- `src/lib/rokid-device.ts`：Rokid query 参数解析和 WebView 启动 URL 规范化。
- `LearningWorkspace` 的 `deviceMode/autostart` 参数。
- `window.__TAOHUAYUAN_ROKID_COMMAND__(action)` 命令入口。
- `data-device-mode="rokid"` 样式钩子。

支持的命令：

```text
start
next
pause
home
reset
reload
```

## 构建眼镜端 APK

准备：

- Android Studio
- Android SDK 36
- JDK 17 或更新版本

构建：

```powershell
cd rokid/android
.\gradlew.bat :glass-webview:assembleRelease -PTAOHUA_WEB_BASE_URL=https://your-domain.com
```

输出通常位于：

```text
rokid/android/glass-webview/build/outputs/apk/release/glass-webview-release-unsigned.apk
```

正式发布前请配置签名。给手机端控制器上传时，将 APK 重命名为：

```text
taohuayuan-glass.apk
```

## 构建手机端控制 APK

```powershell
cd rokid/android
.\gradlew.bat :mobile-controller:assembleRelease
```

输出通常位于：

```text
rokid/android/mobile-controller/build/outputs/apk/release/mobile-controller-release-unsigned.apk
```

## 设备流程

1. 确认手机已安装 Rokid AI App。
2. 安装 `mobile-controller` 到手机。
3. 将 `taohuayuan-glass.apk` 放到手机：

```text
/sdcard/Download/taohuayuan-glass.apk
```

或：

```text
/sdcard/DCIM/Rokid/taohuayuan-glass.apk
```

4. 打开手机端控制器。
5. 点 `Check Rokid AI App`。
6. 点 `Request Authorization`，完成 Rokid 授权。
7. 点 `Connect CUSTOMAPP Session`。
8. 点 `Install Glass APK`。
9. 点 `Start Glass App`。
10. 使用 `Game: Start / Next / Pause / Reset / Reload` 控制眼镜端游戏。

## 生产部署要求

- Web 服务必须使用 HTTPS。
- AI / TTS 密钥只放服务端，不能放入 Android APK。
- `/api/chat`、`/api/session/*`、静态图片/音频/视频资源必须能被眼镜 WebView 访问。
- 正式课堂记录不要依赖内存会话，建议后续把 `session-store` 换成数据库或 Redis。
- 眼镜端弱网时 WebView 会显示加载失败状态，手机端日志会收到 `ready:` 或 `web:` 状态消息。

## 验收清单

- 手机端能完成 Rokid 授权并拿到 token。
- `CUSTOMAPP` 会话中 `onCXRLConnected(true)` 和 `onGlassBtConnected(true)` 均出现。
- 手机端能查询眼镜端 APK 是否安装。
- 手机端能上传并安装 `taohuayuan-glass.apk`。
- 手机端能启动眼镜端 `com.taohuayuan.rokid.glass.MainActivity`。
- 眼镜端 WebView 能打开线上 `/learn/taohuayuanji?device=rokid&autostart=1`。
- `Game: Next` 能推动剧情。
- `Game: Pause` 能暂停/继续。
- 音频、视频、字幕和 NPC 对话在眼镜横屏下不遮挡主要内容。

## 本机验证

当前仓库侧可运行：

```powershell
npm run test:rokid
npm run lint
npm run build
```

Android APK 构建需要本机安装 Java、Android SDK 和 Android Studio。本开发机目前没有这些工具，因此 Android 编译需要在 Android 开发环境中执行。
