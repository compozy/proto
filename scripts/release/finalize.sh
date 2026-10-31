#!/usr/bin/env bash
set -euo pipefail
# Resolve remote tags as well, including annotated tags, before any mutation.
remote_tag=$(git ls-remote origin "refs/tags/${RELEASE_TAG}" "refs/tags/${RELEASE_TAG}^{}")
if [[ -n "$remote_tag" ]]; then
  remote_commit=$(printf '%s\n' "$remote_tag" | tail -n 1 | cut -f 1)
  test "$remote_commit" = "$RELEASE_COMMIT"
fi
if git rev-parse "refs/tags/${RELEASE_TAG}" >/dev/null 2>&1; then
  test "$(git rev-list -n 1 "${RELEASE_TAG}")" = "${RELEASE_COMMIT}"
else
  git tag "${RELEASE_TAG}" "${RELEASE_COMMIT}"
fi
if [[ -z "$remote_tag" ]]; then
  git push origin "refs/tags/${RELEASE_TAG}"
fi
if gh release view "$RELEASE_TAG" >/dev/null 2>&1; then
  test "$(gh release view "$RELEASE_TAG" --json isPrerelease --jq .isPrerelease)" = "$PRERELEASE"
else
  notes=".release-notes/${RELEASE_TAG}.md"
  if [[ ! -s "$notes" ]]; then
    mkdir -p .release-notes
    git-cliff --current --tag "$RELEASE_TAG" > "$notes"
  fi
  grep -Fq "## ${RELEASE_TAG}" "$notes"
  args=(--verify-tag --target "$RELEASE_COMMIT" --title "$RELEASE_TAG" --notes-file "$notes")
  if [[ "$PRERELEASE" == true ]]; then args+=(--prerelease --latest=false); else args+=(--latest); fi
  gh release create "$RELEASE_TAG" "${args[@]}"
fi
