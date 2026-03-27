

## Plan: Zoom & Center Team Logos to Remove Crop Borders

### Problem
The logos cropped from the collage include visible borders/background from adjacent cells. The actual logo artwork sits in the center of each crop, surrounded by colored background.

### Solution
Re-run the cropping script with **inset margins** — crop a smaller region from the center of each cell to exclude the border areas. This zooms into the actual logo content.

### How

1. **Re-crop with ~15-20% inset** on each side of each cell
   - Original cell size: ~356x222px
   - New crop: trim ~55px from left/right and ~35px from top/bottom per cell
   - This focuses on the central logo artwork and removes the colored border strips

2. **Save to same filenames** in `src/assets/logos/` so `TeamLogo.tsx` continues to work without changes

3. **QA each logo** visually to confirm clean crops with no border artifacts

### Files

| Action | File | What |
|--------|------|------|
| Script | `/tmp/crop_logos_v2.py` | Re-crop with inset margins |
| Replace | `src/assets/logos/*.png` | 8 updated logo files |

