# Game asset credits

Every asset in this folder is CC0 or OFL.
CC0 requires no attribution; we credit each pack anyway, because the people who made these gave
them away and that deserves saying out loud.

Only the sheets actually loaded by a scene are committed. The full packs are much larger; the
folder is kept small on purpose.

| Pack | Author | License | Files kept | Source |
|---|---|---|---|---|
| Tiny Dungeon | Kenney | CC0 1.0 | `kenney-tiny-dungeon/tilemap_packed.png` | https://kenney.nl/assets/tiny-dungeon |
| Monster Builder Pack | Kenney | CC0 1.0 | `kenney-monster-builder/spritesheet_default.png` and its XML atlas | https://kenney.nl/assets/monster-builder-pack |
| Pixel UI Pack | Kenney | CC0 1.0 | `kenney-pixel-ui/UIpackSheet_transparent.png` | https://kenney.nl/assets/pixel-ui-pack |
| RPG Audio | Kenney | CC0 1.0 | four sounds: `metalClick`, `handleCoins`, `knifeSlice`, `doorOpen_1` | https://kenney.nl/assets/rpg-audio |

## Not included

**0x72 Dungeon Tileset II** is listed in `docs/SPEC.md` §8.6 but is not committed here. It is hosted
on itch.io behind a download flow this environment could not complete non-interactively. Nothing
depends on it: the raid boss is drawn from the Kenney Monster Builder sheet instead, which is CC0
and serves the same purpose.

## Fonts

Press Start 2P and Pixelify Sans are OFL and are loaded from Google Fonts at runtime rather than
committed, so there is nothing to redistribute here.
