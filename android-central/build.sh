#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
SDK="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
if [[ -z "$SDK" || ! -d "$SDK" ]]; then echo "Android SDK unavailable" >&2; exit 1; fi
BT="$SDK/build-tools/34.0.0"
PLATFORM="$SDK/platforms/android-34/android.jar"
if [[ ! -f "$PLATFORM" || ! -x "$BT/aapt2" ]]; then
  "$SDK/cmdline-tools/latest/bin/sdkmanager" "platforms;android-34" "build-tools;34.0.0"
fi
mkdir -p build/classes build/dex dist
"$BT/aapt2" compile --dir res -o build/resources.zip
"$BT/aapt2" link -I "$PLATFORM" --manifest AndroidManifest.xml -o build/unsigned.apk build/resources.zip
javac -source 8 -target 8 -bootclasspath "$PLATFORM" -d build/classes src/br/com/centralseries/admin/MainActivity.java
"$BT/d8" --release --lib "$PLATFORM" --min-api 23 --output build/dex $(find build/classes -name '*.class')
(cd build/dex && zip -q ../unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 build/unsigned.apk build/aligned.apk
KEYSTORE="${CENTRAL_KEYSTORE:-$HOME/.central-series/signing.p12}"
mkdir -p "$(dirname "$KEYSTORE")"
chmod 700 "$(dirname "$KEYSTORE")"
umask 077
if [[ ! -f "$KEYSTORE" ]]; then
  if [[ -z "${CENTRAL_KEYSTORE_PASSWORD:-}" ]]; then
    openssl rand -hex 24 > "$KEYSTORE.password"
    CENTRAL_KEYSTORE_PASSWORD="$(cat "$KEYSTORE.password")"
  fi
  export CENTRAL_KEYSTORE_PASSWORD
  keytool -genkeypair -keystore "$KEYSTORE" -storetype PKCS12 -alias central \
   -keyalg RSA -keysize 3072 -validity 10000 -dname "CN=Central Series Android" \
   -storepass:env CENTRAL_KEYSTORE_PASSWORD -keypass:env CENTRAL_KEYSTORE_PASSWORD
fi
if [[ -z "${CENTRAL_KEYSTORE_PASSWORD:-}" && -f "$KEYSTORE.password" ]]; then
  CENTRAL_KEYSTORE_PASSWORD="$(cat "$KEYSTORE.password")"
fi
export CENTRAL_KEYSTORE_PASSWORD
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-key-alias central \
  --ks-pass env:CENTRAL_KEYSTORE_PASSWORD --key-pass env:CENTRAL_KEYSTORE_PASSWORD \
  --out dist/Central-Series.apk build/aligned.apk
"$BT/apksigner" verify --verbose --print-certs dist/Central-Series.apk
"$BT/aapt2" dump badging dist/Central-Series.apk
sha256sum dist/Central-Series.apk > dist/Central-Series.apk.sha256
