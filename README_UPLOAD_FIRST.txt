VIRUZ PET — improved sprite replacements (PNG, drop-in)

HOW TO USE
1. Unzip this part.
2. Drag the `assets` folder onto your repository root on GitHub (or copy it
   over your local clone) and confirm the overwrite.
3. Paths and file names already match the repo exactly, so no code changes
   are needed for existing art.

WHAT IS INSIDE
- assets/sprites/<folder>/still.png        (enemies / AntiviruZ)
- assets/sprites_v2/<species>/<form>_<attr>.png   (your pets)

NOTES
- Every file is 512x512 with a transparent background.
- Enemy facing already matches each entry's `faces` value in src/data.js,
  so nothing renders mirrored.
- `assets/sprites/stone_imp/` and `assets/sprites/fang_stalker/` are NEW
  folders. Those two currently render from procedural SVG shapes. To use the
  new art, give them `gif` and `ext` fields in src/data.js, for example:
      stone_imp: { ..., gif:'stone_imp', ext:'png', faces:'right', scale:1.0, ... }
      fang_stalker: { ..., gif:'fang_stalker', ext:'png', faces:'right', scale:1.0, ... }
- `attack.png` files are untouched.
