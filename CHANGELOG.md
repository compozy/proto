# Changelog

## v0.1.3

### Features

- add icon aliases and color toast icons by type

### Fixes

- publish when the release merge keeps pr-release's commit subject (#14)

### Maintenance

- ignore dist-gallery output
- upgrade base-ui to 1.8.0 and patch anchor tracking

## v0.1.2

### Features

- ship the proto and proto-apply-comments agent skills (#10)

### Maintenance

- pin the browser project's localhost to its own server (#7)
- wait for the frame's ready handshake in the comment mode suite (#9)
- missings skills
- release with pr-release and bump the patch while on 0.x (#12)

## v0.1.1

### Fixes

- verify releases by provenance and make the package build reproducible (#5)

## v0.1.0

### Features

- scaffold proto from stack (api)
- add @compozy/proto, the prototype library (#1)

### Maintenance

- drop the gallery-shell draft copied from the template
- add the proto-library spec
- add the apply-prototype-comments skill
- incorporate round-1 spec peer review
- incorporate round-2 spec peer review
- make the deployed review journey independent of DNS (#3)
- serve the built SPA in the deployed review journey (#4)
