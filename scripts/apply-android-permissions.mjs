#!/usr/bin/env node
/**
 * Capacitor regenerates android/app on CI, so keep its WebView/activity/provider
 * declarations intact and add only the permissions used by Kavvanah.
 * Run after `cap sync android` and `capacitor-assets generate`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const ANDROID_PERMISSIONS = [
  // The bundled WebView serves offline content; online links and sync still need network.
  'android.permission.INTERNET',
  // `navigator.geolocation.getCurrentPosition()` is called only on a user's tap.
  // Android 12+ can grant approximate location without granting precise location.
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
];

export const OPTIONAL_HARDWARE = [
  // Avoid filtering out Wi-Fi-only tablets and devices without a magnetometer.
  'android.hardware.location.gps',
  'android.hardware.sensor.compass',
];

export function applyPermissions(xml) {
  if (!/<manifest\b[^>]*xmlns:android\s*=\s*["']http:\/\/schemas\.android\.com\/apk\/res\/android["'][^>]*>/s.test(xml) ||
      !/<application(?:\s|>)/.test(xml) || !/<\/manifest>/.test(xml)) {
    throw new Error('Expected a generated Capacitor AndroidManifest.xml with a valid manifest and application tag');
  }
  const additions = [];
  for (const permission of ANDROID_PERMISSIONS) {
    const escaped = permission.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`<uses-permission\\b[^>]*android:name\\s*=\\s*["']${escaped}["']`, 's').test(xml)) {
      additions.push(`    <uses-permission android:name="${permission}" />`);
    }
  }
  for (const feature of OPTIONAL_HARDWARE) {
    const escaped = feature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const featureTag = new RegExp(`<uses-feature\\b(?=[^>]*android:name\\s*=\\s*["']${escaped}["'])[^>]*>`, 's');
    const match = xml.match(featureTag);
    if (match) {
      if (!/android:required\s*=\s*["']false["']/.test(match[0])) {
        throw new Error(`${feature} must be marked android:required="false"`);
      }
    } else {
      additions.push(`    <uses-feature android:name="${feature}" android:required="false" />`);
    }
  }
  if (!additions.length) return xml;
  return xml.replace(/([ \t]*<application(?:\s|>))/, `${additions.join('\n')}\n\n$1`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const manifestPath = resolve(process.argv[2] || 'packaging/android/android/app/src/main/AndroidManifest.xml');
  const original = readFileSync(manifestPath, 'utf8');
  const modified = applyPermissions(original);
  if (original !== modified) writeFileSync(manifestPath, modified);
  console.log(`Verified Android location/network permissions and optional device sensors: ${manifestPath}`);
}
