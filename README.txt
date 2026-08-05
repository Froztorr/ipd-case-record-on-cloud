VIRUZ - PET SPRITES v3 (16-bit pixel art) - PNG part 2 of 4

CONTAINS: hopbit, jetsquid, chitbug, echowing

HOW TO INSTALL
1. Unzip this file.
2. On github.com open your repo, then Add file > Upload files.
   Drag in the `assets` folder from this unzipped part.
   Existing same-named files are overwritten.
3. No code changes needed. These are drop-in replacements matching the paths
   produced by spriteV2Path() in src/sprites.js:
       assets/sprites_v2/<speciesId>/<form>_<attr>.png

FILES PER SPECIES: 20 = 5 forms x 4 attributes
  forms .... stage1, overclock, bulwark, phantom, corrupted
  attrs .... green, red, yellow, white

SPEC: 512x512 PNG, RGBA transparent, 64x64 logical pixel grid upscaled x8
      (nearest-neighbour), max 32 colours per sprite, no anti-aliasing.

ART DIRECTION
  stage1 .... cute-but-stylish base creature
  overclock . evolved, glowing circuit lines, partly cyber
  bulwark ... NATURAL juggernaut - its own bulkier body, thick bony plates
              and organic spikes. No man-made armour.
  phantom ... translucent floating ghost form
  corrupted . DRY digital data corruption - purple cracks, drifting voxel
              fragments, RGB channel-split. No gore, no ooze.
