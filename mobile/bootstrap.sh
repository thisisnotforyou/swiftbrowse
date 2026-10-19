#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cp "$ROOT/pubspec.yaml" "$TMP/pubspec.yaml"
cp -R "$ROOT/lib" "$TMP/lib"

cd "$ROOT"
flutter create --no-pub --overwrite --org app.swiftbrowse --project-name swiftbrowse_mobile --platforms=android,ios .

cp "$TMP/pubspec.yaml" "$ROOT/pubspec.yaml"
rm -rf "$ROOT/test"
rm -rf "$ROOT/lib"
cp -R "$TMP/lib" "$ROOT/lib"

echo "Generated Android and iOS projects. Run 'flutter pub get' before building."
