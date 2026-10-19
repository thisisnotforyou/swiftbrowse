#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cp "$ROOT/pubspec.yaml" "$TMP/pubspec.yaml"
cp -R "$ROOT/lib" "$TMP/lib"

cd "$ROOT"
flutter create --no-pub --overwrite --org app.swiftbrowse --project-name swiftbrowse_mobile --platforms=android,ios .
FLUTTER_SDK="${FLUTTER_ROOT:-$(cd "$(dirname "$(command -v flutter)")/.." && pwd)}"

cp "$TMP/pubspec.yaml" "$ROOT/pubspec.yaml"
rm -rf "$ROOT/test"
rm -rf "$ROOT/lib"
cp -R "$TMP/lib" "$ROOT/lib"

python3 - "$FLUTTER_SDK/packages/flutter_tools/gradle/settings.gradle.kts" <<'PY'
from pathlib import Path
import sys

settings = Path(sys.argv[1])
source = settings.read_text()
if "pluginManagement {" not in source:
    source = "pluginManagement {\n    repositories {\n        google()\n        mavenCentral()\n        gradlePluginPortal()\n    }\n}\n\n" + source
elif "mavenCentral()" not in source.split("pluginManagement {", 1)[1].split("}", 1)[0]:
    source = source.replace(
        "pluginManagement {",
        "pluginManagement {\n    repositories {\n        google()\n        mavenCentral()\n        gradlePluginPortal()\n    }",
        1,
    )
settings.write_text(source)
PY

echo "Generated Android and iOS projects. Run 'flutter pub get' before building."
