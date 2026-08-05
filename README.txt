VIRUZ - PET SPRITES v3 (16-bit pixel art) - ANIMATED GIF part 4 of 4

CONTAINS: orbling, haunbit

WHAT THESE ARE
Idle "breathing" animations. Each sprite gently squashes and stretches on a
1.2 second loop while its feet stay planted on the ground.

SPEC: 512x512 animated GIF, transparent background, loops forever,
      1200 ms per cycle. Identical framing and palette to the matching PNG.

HOW TO INSTALL
1. Unzip this file.
2. On github.com open your repo, then Add file > Upload files.
   Drag in the `assets` folder from this unzipped part.
3. ONE CODE CHANGE is required, because these are .gif and not .png.
   In src/sprites.js, spriteV2Path() currently ends with:

       return `${ART2_BASE}/${speciesId}/${file}.png`;

   Change `.png` to `.gif`:

       return `${ART2_BASE}/${speciesId}/${file}.gif`;

   That single edit switches every pet over to the animated versions.
   Do this AFTER uploading the GIFs, or the images will 404.

TIP: keep the PNG pack installed too. The GIFs sit alongside the PNGs
(same folder, same names, different extension), so you can flip between
static and animated by changing that one line back and forth.

FILES PER SPECIES: 20 = 5 forms x 4 attributes
  forms .... stage1, overclock, bulwark, phantom, corrupted
  attrs .... green, red, yellow, white
