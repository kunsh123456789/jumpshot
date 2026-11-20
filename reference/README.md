# Animation references

Drop reference material in this folder and the animation pass will match it:

- **GIF frames or contact sheets** from stick-fight animations you like (Stick Nodes, Pivot, Alan Becker, Xiao Xiao style). Extract frames with ffmpeg:
  ```bash
  ffmpeg -i clip.gif -vsync 0 frames/clip_%03d.png
  ```
  or make a contact sheet:
  ```bash
  ffmpeg -i clip.gif -vf "tile=8x4" sheet.png
  ```
- A short note per file on what to take from it, for example "the launcher crouch depth", "smear shape on kicks" or "3-frame hold on contact".

When this folder has images, they are studied before any animation work: line weight, proportions, pose exaggeration, timing (count the frames between keys), smear shapes and impact frames. The results are transferred into `src/data/anims/`.

Current contents: `sheet_000-099` and `sheet_360-466` (the first reference clip, contact sheets of every frame) and `gif2_sheet0-5` (a second clip, frames 0-358, every other frame). What was taken from each is in `REFERENCE_NOTES.md`.
