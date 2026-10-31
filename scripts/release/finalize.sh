#!/usr/bin/env bash
set -euo pipefail
if git rev-parse "refs/tags/${RELEASE_TAG}" >/dev/null 2>&1; then
  test "$(git rev-list -n 1 "${RELEASE_TAG}")" = "${RELEASE_COMMIT}"
else
  git tag "${RELEASE_TAG}" "${RELEASE_COMMIT}"
  git push origin "refs/tags/${RELEASE_TAG}"
fi
notes=".release-notes/${RELEASE_TAG}.md"
if [[ ! -s "$notes" ]]; then
  mkdir -p .release-notes
  git-cliff --current --tag "$RELEASE_TAG" > "$notes"
fi
grep -Fq "## ${RELEASE_TAG}" "$notes"
if gh release view "$RELEASE_TAG" >/dev/null 2>&1; then
  test "$(gh release view "$RELEASE_TAG" --json isPrerelease --jq .isPrerelease)" = "$PRERELEASE"
else
  args=(--verify-tag --target "$RELEASE_COMMIT" --title "$RELEASE_TAG" --notes-file "$notes")
  if [[ "$PRERELEASE" == true ]]; then args+=(--prerelease --latest=false); else args+=(--latest); fi
  gh release create "$RELEASE_TAG" "${args[@]}"
fi
