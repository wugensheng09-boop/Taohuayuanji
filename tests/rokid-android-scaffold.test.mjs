import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const androidRoot = path.resolve("rokid/android");

function readProjectFile(relativePath) {
  const filePath = path.join(androidRoot, relativePath);
  assert.equal(existsSync(filePath), true, `${relativePath} should exist`);
  return readFileSync(filePath, "utf8");
}

test("Rokid Android project declares glass and mobile controller modules", () => {
  const settings = readProjectFile("settings.gradle.kts");

  assert.match(settings, /include\(":glass-webview"\)/);
  assert.match(settings, /include\(":mobile-controller"\)/);
});

test("glass WebView module targets the formal Taohuayuan package and launch route", () => {
  const gradle = readProjectFile("glass-webview/build.gradle.kts");
  const activity = readProjectFile(
    "glass-webview/src/main/java/com/taohuayuan/rokid/glass/MainActivity.kt",
  );

  assert.match(gradle, /applicationId = "com\.taohuayuan\.rokid\.glass"/);
  assert.match(activity, /appendQueryParameter\("device", "rokid"\)/);
  assert.doesNotMatch(activity, /appendQueryParameter\("autostart", "1"\)/);
  assert.doesNotMatch(activity, /\/learn\/taohuayuanji/);
  assert.match(activity, /RokidNativeBridge/);
  assert.match(activity, /SpeechRecognizer/);
  assert.match(activity, /startSpeechRecognition/);
});

test("mobile controller module is wired for CXR-L CUSTOMAPP control", () => {
  const gradle = readProjectFile("mobile-controller/build.gradle.kts");
  const controller = readProjectFile(
    "mobile-controller/src/main/java/com/taohuayuan/rokid/controller/MainActivity.kt",
  );

  assert.match(gradle, /com\.rokid\.cxr:client-l:1\.0\.1/);
  assert.match(controller, /CxrDefs\.CXRSessionType\.CUSTOMAPP/);
  assert.match(controller, /com\.taohuayuan\.rokid\.glass/);
  assert.match(controller, /appUploadAndInstall/);
  assert.match(controller, /sendCustomCmd/);
  assert.match(controller, /choice:a/);
  assert.match(controller, /choice:b/);
  assert.match(controller, /choice:c/);
  assert.match(controller, /Game: Skip \/ Unstick/);
  assert.match(controller, /sendGameCommand\("skip"\)/);
});
