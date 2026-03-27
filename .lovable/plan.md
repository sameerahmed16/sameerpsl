

## Plan: Extract Team Logos from Collage

### What
Crop 8 individual team logos from the uploaded collage image and replace the current logo files used in `TeamLogo.tsx`.

### How

1. **Copy the collage** to `/tmp/` for processing
2. **Run a Python script** to crop each team logo from its grid position:
   - Top row: Islamabad United (left), Lahore Qalandars (right)
   - Middle row: Karachi Kings (left), Peshawar Zalmi (right)
   - Third row: Quetta Gladiators (left), Multan Sultans (right)
   - Bottom row: Rawalpindi Pindiz (left), Hyderabad Kingsmen (right)
3. **Save cropped logos** to `src/assets/logos/` with the existing filenames so `TeamLogo.tsx` imports work without changes
4. **QA** each extracted logo visually to ensure clean crops

### Files

| Action | File | What |
|--------|------|------|
| Script | `/tmp/crop_logos.py` | PIL-based cropping of 8 logos from collage |
| Replace | `src/assets/logos/*.png` | 8 individual team logo files |

No code changes needed — `TeamLogo.tsx` already imports from these paths.

