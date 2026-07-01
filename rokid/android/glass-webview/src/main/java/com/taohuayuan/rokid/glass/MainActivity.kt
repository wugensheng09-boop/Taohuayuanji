package com.taohuayuan.rokid.glass

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.TextView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.rokid.cxr.CXRServiceBridge
import com.rokid.cxr.Caps
import org.json.JSONObject
import java.util.Locale

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var statusView: TextView
    private val cxrBridge = CXRServiceBridge()
    private val clientCommandKey = "rk_custom_client"
    private val statusReplyKey = "taohuayuan_game_status"
    private var speechRecognizer: SpeechRecognizer? = null
    private var speechRequestId: String = ""

    private val bridgeStatusListener = object : CXRServiceBridge.StatusListener {
        override fun onConnected(p0: String?, p1: String?, p2: Int) {
            showStatus("CXR bridge connected")
        }

        override fun onDisconnected() {
            showStatus("CXR bridge disconnected")
        }

        override fun onConnecting(p0: String?, p1: String?, p2: Int) {
            showStatus("CXR bridge connecting")
        }

        override fun onARTCStatus(p0: Float, p1: Boolean) = Unit
        override fun onRokidAccountChanged(p0: String?) = Unit
    }

    private val commandCallback = object : CXRServiceBridge.MsgCallback {
        override fun onReceive(name: String?, args: Caps?, bytes: ByteArray?) {
            val action = extractAction(args) ?: return
            runOnUiThread {
                sendActionToWeb(action)
                sendStatusToPhone("command:$action")
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        enterImmersiveMode()
        requestAudioPermissionIfNeeded()

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        webView = WebView(this)
        statusView = TextView(this).apply {
            text = "Loading Taohuayuan..."
            setTextColor(0xfff7ead2.toInt())
            setBackgroundColor(0x66000000)
            textSize = 13f
            setPadding(20, 12, 20, 12)
        }

        setContentView(FrameLayout(this).apply {
            addView(webView, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
            addView(statusView, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT)
        })

        configureWebView()
        cxrBridge.setStatusListener(bridgeStatusListener)
        cxrBridge.subscribe(clientCommandKey, commandCallback)
        webView.loadUrl(buildLaunchUrl())
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enterImmersiveMode()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        return when (keyCode) {
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_SPACE -> {
                sendActionToWeb("next")
                true
            }
            KeyEvent.KEYCODE_BACK -> {
                if (webView.canGoBack()) {
                    webView.goBack()
                    true
                } else {
                    super.onKeyDown(keyCode, event)
                }
            }
            else -> super.onKeyDown(keyCode, event)
        }
    }

    override fun onDestroy() {
        stopSpeechRecognition()
        webView.destroy()
        super.onDestroy()
    }

    private fun configureWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowContentAccess = false
            allowFileAccess = false
            javaScriptCanOpenWindowsAutomatically = false
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE
            userAgentString = "$userAgentString TaohuayuanRokid/1.0 RokidMAXProEnterprise"
        }
        webView.addJavascriptInterface(RokidNativeBridge(), "RokidNativeBridge")
        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                request.grant(request.resources)
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                showStatus("Ready")
                sendStatusToPhone("ready:${url.orEmpty()}")
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?,
            ) {
                if (request?.isForMainFrame == true) {
                    showStatus("Load failed: ${error?.description ?: "unknown"}")
                }
            }
        }
    }

    private fun buildLaunchUrl(): String {
        return Uri.parse(BuildConfig.TAOHUA_WEB_BASE_URL)
            .buildUpon()
            .appendQueryParameter("device", "rokid")
            .build()
            .toString()
    }

    private fun extractAction(caps: Caps?): String? {
        if (caps == null || caps.size() == 0) return null
        if (caps.size() >= 2 && caps.at(0).type() == Caps.Value.TYPE_STRING) {
            val replyKey = caps.at(0).string
            if (replyKey == statusReplyKey && caps.at(1).type() == Caps.Value.TYPE_STRING) {
                return caps.at(1).string
            }
        }
        return if (caps.at(0).type() == Caps.Value.TYPE_STRING) caps.at(0).string else null
    }

    private fun sendActionToWeb(action: String) {
        val safeAction = action.replace("\\", "\\\\").replace("'", "\\'")
        val script = "window.__TAOHUAYUAN_ROKID_COMMAND__ && window.__TAOHUAYUAN_ROKID_COMMAND__('$safeAction');"
        webView.evaluateJavascript(script, null)
    }

    private fun sendStatusToPhone(message: String) {
        cxrBridge.sendMessage(statusReplyKey, Caps().apply {
            write("message")
            write(message)
        })
    }

    private fun showStatus(message: String) {
        Log.d("TaohuayuanGlass", message)
        statusView.text = message
        statusView.postDelayed({ statusView.text = "" }, 2600)
    }

    private fun enterImmersiveMode() {
        window.decorView.systemUiVisibility =
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
    }

    private fun requestAudioPermissionIfNeeded() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), 1002)
        }
    }

    private fun startSpeechRecognition(requestId: String) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), 1002)
            sendSpeechResult(requestId, "", true, "microphone-permission")
            return
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            sendSpeechResult(requestId, "", true, "speech-unavailable")
            return
        }

        stopSpeechRecognition()
        speechRequestId = requestId
        val recognizer = SpeechRecognizer.createSpeechRecognizer(this)
        speechRecognizer = recognizer
        recognizer.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                showStatus("Listening")
            }

            override fun onBeginningOfSpeech() = Unit
            override fun onRmsChanged(rmsdB: Float) = Unit
            override fun onBufferReceived(buffer: ByteArray?) = Unit
            override fun onEndOfSpeech() = Unit

            override fun onError(error: Int) {
                sendSpeechResult(speechRequestId, "", true, "speech-error-$error")
                stopSpeechRecognition()
            }

            override fun onResults(results: Bundle?) {
                val text = results
                    ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull()
                    .orEmpty()
                sendSpeechResult(speechRequestId, text, true)
                stopSpeechRecognition()
            }

            override fun onPartialResults(partialResults: Bundle?) {
                val text = partialResults
                    ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    ?.firstOrNull()
                    .orEmpty()
                if (text.isNotBlank()) {
                    sendSpeechResult(speechRequestId, text, false)
                }
            }

            override fun onEvent(eventType: Int, params: Bundle?) = Unit
        })

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.SIMPLIFIED_CHINESE.toLanguageTag())
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }
        recognizer.startListening(intent)
    }

    private fun stopSpeechRecognition() {
        speechRecognizer?.apply {
            try {
                stopListening()
            } catch (_: RuntimeException) {
                // Recognition service may already be stopped.
            }
            destroy()
        }
        speechRecognizer = null
    }

    private fun sendSpeechResult(requestId: String, text: String, isFinal: Boolean, error: String? = null) {
        val payload = JSONObject()
            .put("requestId", requestId)
            .put("text", text)
            .put("final", isFinal)
        if (error != null) {
            payload.put("error", error)
        }
        val script =
            "window.__TAOHUAYUAN_NATIVE_SPEECH_RESULT__ && window.__TAOHUAYUAN_NATIVE_SPEECH_RESULT__(${payload});"
        webView.evaluateJavascript(script, null)
    }

    inner class RokidNativeBridge {
        @JavascriptInterface
        fun postStatus(message: String) {
            runOnUiThread { sendStatusToPhone("web:$message") }
        }

        @JavascriptInterface
        fun startSpeechRecognition(requestId: String?) {
            runOnUiThread { this@MainActivity.startSpeechRecognition(requestId.orEmpty()) }
        }

        @JavascriptInterface
        fun stopSpeechRecognition() {
            runOnUiThread { this@MainActivity.stopSpeechRecognition() }
        }
    }
}
