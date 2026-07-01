package com.taohuayuan.rokid.controller

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.Environment
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.rokid.cxr.Caps
import com.rokid.cxr.link.CXRLink
import com.rokid.cxr.link.callbacks.ICXRLinkCbk
import com.rokid.cxr.link.callbacks.ICustomCmdCbk
import com.rokid.cxr.link.callbacks.IGlassAppCbk
import com.rokid.cxr.link.utils.CxrDefs
import com.rokid.sprite.aiapp.externalapp.auth.AuthResult
import com.rokid.sprite.aiapp.externalapp.auth.AuthorizationHelper
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : Activity() {
    private lateinit var logView: TextView
    private var token: String = ""
    private var cxrLink: CXRLink? = null
    private var cxrlConnected = false
    private var glassBtConnected = false

    private val appCallback = object : IGlassAppCbk {
        override fun onInstallAppResult(success: Boolean) {
            log("Install glass APK result: $success")
            if (success) queryInstalled()
        }

        override fun onUnInstallAppResult(success: Boolean) {
            log("Uninstall result: $success")
        }

        override fun onOpenAppResult(success: Boolean) {
            log("Open glass app result: $success")
        }

        override fun onStopAppResult(success: Boolean) {
            log("Stop glass app result: $success")
        }

        override fun onGlassAppResume(resumed: Boolean) {
            log("Glass app resumed: $resumed")
        }

        override fun onQueryAppResult(installed: Boolean) {
            log("Glass app installed: $installed")
        }
    }

    private val linkCallback = object : ICXRLinkCbk {
        override fun onCXRLConnected(connected: Boolean) {
            cxrlConnected = connected
            log("CXR-L connected: $connected")
        }

        override fun onGlassBtConnected(connected: Boolean) {
            glassBtConnected = connected
            log("Glass Bluetooth connected: $connected")
        }

        override fun onGlassAiAssistStart() {
            log("AI assist started")
        }

        override fun onGlassAiAssistStop() {
            log("AI assist stopped")
        }
    }

    private val customCmdCallback = object : ICustomCmdCbk {
        override fun onCustomCmdResult(key: String?, payload: ByteArray?) {
            if (key != STATUS_REPLY_KEY || payload == null) return
            val caps = Caps.fromBytes(payload)
            val message = parseCaps(caps)
            log("From glass: $message")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(buildUi())
        checkRequiredApp()
    }

    @Deprecated("CXR-L authorization currently returns through onActivityResult.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == AUTH_REQUEST_CODE) {
            parseAuthorization(resultCode, data)
        }
    }

    private fun buildUi(): ScrollView {
        logView = TextView(this).apply {
            textSize = 13f
            setTextColor(0xff24180c.toInt())
            text = "Taohuayuan Rokid controller\n"
        }
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 28, 28, 28)
            addView(button("Check Rokid AI App") { checkRequiredApp() })
            addView(button("Request Authorization") {
                AuthorizationHelper.INSTANCE.requestAuthorization(this@MainActivity, AUTH_REQUEST_CODE)
            })
            addView(button("Connect CUSTOMAPP Session") { connectCustomApp() })
            addView(button("Query Glass Install") { queryInstalled() })
            addView(button("Install Glass APK") { installGlassApk() })
            addView(button("Start Glass App") { startGlassApp() })
            addView(button("Stop Glass App") { cxrLink?.appStop(appCallback) ?: log("Connect first") })
            addView(button("Game: Start") { sendGameCommand("start") })
            addView(button("Game: Next") { sendGameCommand("next") })
            addView(button("Game: Choice A") { sendGameCommand("choice:a") })
            addView(button("Game: Choice B") { sendGameCommand("choice:b") })
            addView(button("Game: Choice C") { sendGameCommand("choice:c") })
            addView(button("Game: Skip / Unstick") { sendGameCommand("skip") })
            addView(button("Game: Pause") { sendGameCommand("pause") })
            addView(button("Game: Reset") { sendGameCommand("reset") })
            addView(button("Game: Reload") { sendGameCommand("reload") })
            addView(logView)
        }
        return ScrollView(this).apply { addView(layout) }
    }

    private fun button(label: String, onClick: () -> Unit): Button {
        return Button(this).apply {
            text = label
            setOnClickListener { onClick() }
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
            ).apply { bottomMargin = 10 }
        }
    }

    private fun checkRequiredApp() {
        val installed = AuthorizationHelper.INSTANCE.isRequiredRokidAppInstalled(this)
        log("Rokid AI App installed: $installed")
    }

    private fun parseAuthorization(resultCode: Int, data: Intent?) {
        val result = AuthorizationHelper.INSTANCE.parseAuthorizationResult(resultCode, data)
        when (result) {
            is AuthResult.AuthSuccess -> {
                token = result.token
                log("Authorization success")
            }
            is AuthResult.AuthFail -> {
                token = ""
                log("Authorization failed")
            }
            else -> {
                token = ""
                log("Authorization cancelled or empty")
            }
        }
    }

    private fun connectCustomApp() {
        if (token.isBlank()) {
            log("Authorize first")
            return
        }
        cxrLink = CXRLink(this).apply {
            configCXRSession(CxrDefs.CXRSession(CxrDefs.CXRSessionType.CUSTOMAPP, GLASS_PACKAGE_NAME))
            setCXRLinkCbk(linkCallback)
            setCXRCustomCmdCbk(customCmdCallback)
        }
        val started = cxrLink?.connect(token) ?: false
        log("connect(token) requested: $started")
    }

    private fun queryInstalled() {
        cxrLink?.appIsInstalled(appCallback) ?: log("Connect first")
    }

    private fun installGlassApk() {
        val apk = resolveGlassApk()
        if (apk == null) {
            log("Missing $GLASS_APK_FILE_NAME. Put it in app external files, /sdcard/Download, or /sdcard/DCIM/Rokid.")
            return
        }
        log("Uploading APK: ${apk.absolutePath}")
        cxrLink?.appUploadAndInstall(apk.absolutePath, appCallback) ?: log("Connect first")
    }

    private fun startGlassApp() {
        cxrLink?.appStart("$GLASS_PACKAGE_NAME$GLASS_MAIN_ACTIVITY", appCallback) ?: log("Connect first")
    }

    private fun sendGameCommand(action: String) {
        val link = cxrLink
        if (link == null) {
            log("Connect first")
            return
        }
        if (!cxrlConnected || !glassBtConnected) {
            log("Session not fully ready yet; sending anyway: $action")
        }
        link.sendCustomCmd(PHONE_TO_GLASS_KEY, Caps().apply {
            write(STATUS_REPLY_KEY)
            write(action)
        }.serialize())
        log("Sent game command: $action")
    }

    private fun resolveGlassApk(): File? {
        val candidates = listOfNotNull(
            getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)?.resolve(GLASS_APK_FILE_NAME),
            getExternalFilesDir(Environment.DIRECTORY_DCIM + File.separator + "Rokid")?.resolve(GLASS_APK_FILE_NAME),
            filesDir.resolve(GLASS_APK_FILE_NAME),
            File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), GLASS_APK_FILE_NAME),
            File("/sdcard/DCIM/Rokid/$GLASS_APK_FILE_NAME"),
        )
        return candidates.firstOrNull { it.exists() && it.isFile && it.canRead() }
    }

    private fun parseCaps(caps: Caps): String {
        val values = mutableListOf<String>()
        for (index in 0 until caps.size()) {
            val value = caps.at(index)
            values += when (value.type()) {
                Caps.Value.TYPE_STRING -> value.string ?: ""
                Caps.Value.TYPE_INT32, Caps.Value.TYPE_UINT32 -> value.int.toString()
                Caps.Value.TYPE_INT64, Caps.Value.TYPE_UINT64 -> value.long.toString()
                Caps.Value.TYPE_FLOAT -> value.float.toString()
                Caps.Value.TYPE_DOUBLE -> value.double.toString()
                else -> value.type().toString()
            }
        }
        return values.joinToString(prefix = "[", postfix = "]")
    }

    private fun log(message: String) {
        runOnUiThread {
            val stamp = SimpleDateFormat("HH:mm:ss", Locale.US).format(Date())
            logView.text = "$stamp  $message\n${logView.text}"
        }
    }

    companion object {
        private const val AUTH_REQUEST_CODE = 1001
        private const val GLASS_PACKAGE_NAME = "com.taohuayuan.rokid.glass"
        private const val GLASS_MAIN_ACTIVITY = ".MainActivity"
        private const val GLASS_APK_FILE_NAME = "taohuayuan-glass.apk"
        private const val PHONE_TO_GLASS_KEY = "rk_custom_client"
        private const val STATUS_REPLY_KEY = "taohuayuan_game_status"
    }
}
