# Modular assets

This directory is intentionally empty in the template. `builder.js` runs
entirely on procedural geometry until real assets are dropped here.

When production modules are ready, export from Blender as glTF Binary
(`.glb`) with these exact filenames so `builder.js`'s `ASSET_PATHS` picks
them up automatically:

| File               | Represents                                   |
|---------------------|-----------------------------------------------|
| `wall_panel.glb`     | One ~4ft wall panel segment                   |
| `roof_panel.glb`     | One roof panel segment                         |
| `display_door.glb`   | One glass merchandiser/display door segment    |
| `entry_door.glb`     | One personnel entry door segment               |

Model each at real-world scale in meters or feet consistently with
`PANEL_SEGMENT_FT` in `frontend/js/config.js`, centered on its own origin
so `builder.js` can position it the same way it positions the procedural
`BoxGeometry` fallback.
