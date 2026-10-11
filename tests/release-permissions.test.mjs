import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ANDROID_PERMISSIONS, OPTIONAL_HARDWARE, applyPermissions } from '../scripts/apply-android-permissions.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const fixture = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <application android:label="Kavvanah" android:allowBackup="true">
        <activity android:name=".MainActivity" android:exported="true" />
        <provider android:name="androidx.core.content.FileProvider" />
    </application>
</manifest>
`;

test('Android keeps Capacitor declarations, adds foreground geolocation, and stays idempotent', () => {
  const once = applyPermissions(fixture);
  const twice = applyPermissions(once);
  assert.equal(twice, once);
  assert.match(once, /android:name="\.MainActivity"/);
  assert.match(once, /android:name="androidx\.core\.content\.FileProvider"/);
  for (const permission of ANDROID_PERMISSIONS) {
    assert.equal(once.split(`android:name="${permission}"`).length - 1, 1, permission);
    assert.ok(once.indexOf(permission) < once.indexOf('<application'), `${permission} must be a top-level manifest entry`);
  }
  for (const feature of OPTIONAL_HARDWARE) {
    assert.ok(once.includes(`android:name="${feature}" android:required="false"`), feature);
  }
  for (const forbidden of ['ACCESS_BACKGROUND_LOCATION', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE', 'CAMERA', 'RECORD_AUDIO']) {
    assert.ok(!once.includes(`android.permission.${forbidden}`), forbidden);
  }
});

test('Android manifest patch rejects malformed templates and required compass hardware', () => {
  assert.throws(() => applyPermissions('<manifest></manifest>'), /generated Capacitor/);
  assert.throws(() => applyPermissions(fixture.replace('<application', '<uses-feature android:name="android.hardware.sensor.compass" android:required="true" /><application')), /required="false"/);
});

test('Android permission patch CLI applies to the actual manifest path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kav-permissions-'));
  const filename = join(dir, 'AndroidManifest.xml');
  try {
    writeFileSync(filename, fixture);
    const result = spawnSync(process.execPath, ['scripts/apply-android-permissions.mjs', filename], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(filename, 'utf8'), applyPermissions(fixture));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('macOS app declares location purpose and no unrelated sensitive permissions', () => {
  const plist = read('../src-tauri/Info.plist');
  assert.match(plist, /<key>NSLocationUsageDescription<\/key>\s*<string>[^<]+<\/string>/);
  for (const privacy of ['NSCameraUsageDescription', 'NSMicrophoneUsageDescription', 'NSLocationAlwaysUsageDescription']) {
    assert.ok(!plist.includes(privacy), privacy);
  }
});

test('Desktop webview explicitly allows location requests but defaults everything else', () => {
  const main = read('../src-tauri/src/main.rs');
  const cargo = read('../src-tauri/Cargo.toml');
  assert.match(main, /PermissionKind::Geolocation\s*=>\s*PermissionResponse::Allow/);
  assert.match(main, /_\s*=>\s*PermissionResponse::Default/);
  assert.match(cargo, /tauri\s*=\s*\{\s*version\s*=\s*"2\.12"/);
});

test('Release workflow applies and checks permissions on generated platform packages', () => {
  const workflow = read('../.github/workflows/pages.yml');
  const syncIndex = workflow.indexOf('npx cap sync android');
  const assetIndex = workflow.indexOf('npx capacitor-assets generate');
  const manifestIndex = workflow.indexOf('node scripts/apply-android-permissions.mjs');
  const gradleIndex = workflow.indexOf('./gradlew assembleRelease');
  assert.ok(syncIndex >= 0 && assetIndex > syncIndex && manifestIndex > assetIndex && gradleIndex > manifestIndex,
    'Android permissions must be applied after generation and before compilation');
  assert.match(workflow, /aapt" dump permissions release\/Kavvanah-Android-universal\.apk/);
  assert.match(workflow, /PlistBuddy -c 'Print :NSLocationUsageDescription'/);
});
