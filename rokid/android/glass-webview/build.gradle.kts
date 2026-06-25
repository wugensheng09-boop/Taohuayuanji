plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.taohuayuan.rokid.glass"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.taohuayuan.rokid.glass"
        minSdk = 31
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"

        val baseUrl = providers.gradleProperty("TAOHUA_WEB_BASE_URL").orElse("https://example.com").get()
        buildConfigField("String", "TAOHUA_WEB_BASE_URL", "\"${baseUrl.trimEnd('/')}\"")
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlin {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_11)
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.18.0")
    implementation("com.rokid.cxr:cxr-service-bridge:1.0-20260212.103714-88")
}
