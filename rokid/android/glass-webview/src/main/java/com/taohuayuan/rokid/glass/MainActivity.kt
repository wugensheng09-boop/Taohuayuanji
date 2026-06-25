package com.taohuayuan.rokid.glass

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
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

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var statusView: TextView
    private val cxrBridge = CXRServiceBridge()
    private val clientCommandKey = "rk_custom_client"
    private val statusReplyKey = "taohuayuan_game_status"

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
        return Uri.parse("${BuildConfig.TAOHUA_WEB_BASE_URL}/learn/taohuayuanji")
            .buildUpon()
            .appendQueryParameter("device", "rokid")
            .appendQueryParameter("autostart", "1")
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

    inner class RokidNativeBridge {
        @JavascriptInterface
        fun postStatus(message: String) {
            runOnUiThread { sendStatusToPhone("web:$message") }
        }
    }
}
