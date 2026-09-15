const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to fix react-native-ble-advertiser's build.gradle
 * for compatibility with modern Android SDK versions.
 * 
 * Fixes:
 * 1. compileSdkVersion 28 → uses project's compileSdkVersion
 * 2. Missing namespace (required for AGP 8+)
 * 3. Old buildToolsVersion
 * 4. Old react-native dependency format
 */
function withBleAdvertiserFix(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const gradlePath = path.join(
        config.modRequest.projectRoot,
        'node_modules',
        'react-native-ble-advertiser',
        'android',
        'build.gradle'
      );

      if (fs.existsSync(gradlePath)) {
        const newGradle = `apply plugin: 'com.android.library'

android {
    namespace "com.vitorpamplona.bleavertiser"

    if (project.hasProperty('compileSdkVersion')) {
        compileSdkVersion project.compileSdkVersion.toInteger()
    } else {
        compileSdkVersion 35
    }

    defaultConfig {
        minSdkVersion 21
        if (project.hasProperty('targetSdkVersion')) {
            targetSdkVersion project.targetSdkVersion.toInteger()
        } else {
            targetSdkVersion 35
        }
        versionCode 1
        versionName "1.0"
    }
}

dependencies {
    implementation 'com.facebook.react:react-android'
}
`;
        fs.writeFileSync(gradlePath, newGradle, 'utf8');
        console.log('[BleAdvertiserFix] Patched build.gradle successfully');
      } else {
        console.warn('[BleAdvertiserFix] build.gradle not found at:', gradlePath);
      }

      return config;
    },
  ]);
}

module.exports = withBleAdvertiserFix;
