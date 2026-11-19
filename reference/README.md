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

When this pass was made the folder was empty, so the style follows the written brief: thick round-cap lines, strong exaggerated key poses, snap → hold → settle timing, smears and impact frames.
