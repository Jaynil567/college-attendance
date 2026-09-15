const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin to patch react-native-ble-advertiser
 * for compatibility with AGP 8+, React Native 0.86, and Expo SDK 57.
 */
function withBleAdvertiserFix(config) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const nodeModulesDir = path.join(
        config.modRequest.projectRoot,
        'node_modules',
        'react-native-ble-advertiser',
        'android'
      );

      // 1. Patch build.gradle
      const gradlePath = path.join(nodeModulesDir, 'build.gradle');
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
      }

      // 2. Patch BLEAdvertiserModule.java (remove removed RN imports like Systrace)
      const moduleJavaPath = path.join(
        nodeModulesDir,
        'src',
        'main',
        'java',
        'com',
        'vitorpamplona',
        'bleadvertiser',
        'BLEAdvertiserModule.java'
      );
      if (fs.existsSync(moduleJavaPath)) {
        let content = fs.readFileSync(moduleJavaPath, 'utf8');
        content = content
          .replace(/import com\.facebook\.systrace\..*;/g, '')
          .replace(/import com\.facebook\.react\.ReactInstanceManager;/g, '')
          .replace(/import com\.facebook\.react\.ReactRootView;/g, '')
          .replace(/import com\.facebook\.react\.modules\.core\.DefaultHardwareBackBtnHandler;/g, '')
          .replace(/import com\.facebook\.react\.shell\.MainReactPackage;/g, '')
          .replace(/import com\.facebook\.soloader\.SoLoader;/g, '');

        fs.writeFileSync(moduleJavaPath, content, 'utf8');
        console.log('[BleAdvertiserFix] Patched BLEAdvertiserModule.java successfully');
      }

      // 3. Patch BLEAdvertiserPackage.java (remove JavaScriptModule import)
      const packageJavaPath = path.join(
        nodeModulesDir,
        'src',
        'main',
        'java',
        'com',
        'vitorpamplona',
        'bleadvertiser',
        'BLEAdvertiserPackage.java'
      );
      if (fs.existsSync(packageJavaPath)) {
        let content = fs.readFileSync(packageJavaPath, 'utf8');
        content = content.replace(/import com\.facebook\.react\.bridge\.JavaScriptModule;/g, '');

        fs.writeFileSync(packageJavaPath, content, 'utf8');
        console.log('[BleAdvertiserFix] Patched BLEAdvertiserPackage.java successfully');
      }

      return config;
    },
  ]);
}

module.exports = withBleAdvertiserFix;
