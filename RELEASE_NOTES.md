## v0.1.5

### Features

- add proto share for Cloudflare-backed remote review (#19)
- host storybook stories in the proto gallery (#20)

### Fixes

- keep stories run batches alive across browser loss and cold starts (#22)
- warm story files independently before concurrent runs (#23)

## v0.1.4

### Features

- drop state chips from screen cards (#17)
- raise the icon outline weight to bnui v0.1.2

## v0.1.3

### Features

- add icon aliases and color toast icons by type

### Fixes

- publish when the release merge keeps pr-release's commit subject (#14)

### Maintenance

- ignore dist-gallery output
- upgrade base-ui to 1.8.0 and patch anchor tracking

### Performance

- reduce gallery reloads and redundant data work (#16)

## v0.1.2

### Features

- ship the proto and proto-apply-comments agent skills (#10)

### Maintenance

- pin the browser project's localhost to its own server (#7)
- wait for the frame's ready handshake in the comment mode suite (#9)
- missings skills
