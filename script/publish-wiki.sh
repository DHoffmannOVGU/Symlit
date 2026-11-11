#!/usr/bin/env bash
# Publishes docs/wiki/ to the GitHub wiki of this repository.
# The wiki must exist first: enable it in the repository settings and save one
# (empty) page in the browser. After that: bash script/publish-wiki.sh
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
origin="$(git -C "$root" remote get-url origin)"
wiki="${WIKI_URL:-${origin%.git}.wiki.git}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

git clone --quiet "$wiki" "$work"
find "$work" -maxdepth 1 -name '*.md' -delete
cp "$root"/docs/wiki/*.md "$work"/
git -C "$work" add -A
if git -C "$work" diff --cached --quiet; then
  echo "Wiki is already up to date."
  exit 0
fi
git -C "$work" commit --quiet -m "Publish wiki from $(git -C "$root" rev-parse --short HEAD)"
git -C "$work" push --quiet
echo "Published to $wiki"
