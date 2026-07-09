# Door Validation Fix - Complete ✅

## Issue
The frontend was allowing users to add more display doors than physically fit on the front wall. For example, a 30ft wide cooler was allowing 12 display doors when only 6-8 should fit.

## Root Cause
The `maxDisplayDoorsForWidth()` function in `main.js` was using individual door widths (2.5ft for display, 3ft for entry) instead of matching the backend's panel segment logic (4ft segments).

## Solution
Updated the frontend validation to match the backend's logic exactly:
- Uses 4ft panel segments (matching `PANEL_SEGMENT_FT` in backend)
- Calculates: `frontSegCount = round(width / 4)`
- Reserves segments for front entry doors
- Maximum display doors = `min(6, frontSegCount - reserved)`

## Changes Made

### File: `frontend/js/main.js`

**1. Fixed `maxDisplayDoorsForWidth()` function (lines 230-238)**
```javascript
function maxDisplayDoorsForWidth() {
  // Reserve room for any selected front entry doors before allowing the
  // remaining front-wall segments to become display doors.
  // This matches the backend validation logic in pricing.py
  const PANEL_SEGMENT_FT = 4; // Must match backend PANEL_SEGMENT_FT
  const frontSegCount = Math.max(1, Math.round(CONFIG.width / PANEL_SEGMENT_FT));
  const reserved = ['front-left', 'front-right'].filter((d) => CONFIG.entryDoors.includes(d)).length;
  return Math.min(LIMITS.displayDoors[1], Math.max(0, frontSegCount - reserved));
}
```

**2. Updated width change handler (lines 203-213)**
Added automatic re-clamping when width changes:
```javascript
const widthInput = document.getElementById('widthInput');
widthInput.addEventListener('input', () => {
  const value = clamp(Number(widthInput.value) || LIMITS.width[0], LIMITS.width[0], LIMITS.width[1]);
  CONFIG.width = value;
  // Re-clamp display doors if width changed - can't have more doors than segments
  const maxAllowed = maxDisplayDoorsForWidth();
  if (CONFIG.displayDoors > maxAllowed) {
    CONFIG.displayDoors = maxAllowed;
    syncDisplayDoorsUI();
  }
  refreshAll({ reframe: true });
});
```

**3. Entry door handler already correct (lines 260-264)**
The entry door change handler already had the correct re-clamping logic.

## Validation Examples

### 30ft Width (Your Case)
- Segments: 8 (30 ÷ 4 = 7.5 → rounds to 8)
- Max display doors: **6** (capped by LIMITS.displayDoors[1])
- **Before fix**: Allowed 12 doors ❌
- **After fix**: Max 6 doors ✓

### 12ft Width
- Segments: 3 (12 ÷ 4 = 3)
- No entry doors: Max **3** display doors
- 1 front entry: Max **2** display doors
- 2 front entries: Max **1** display door

### 8ft Width (Minimum)
- Segments: 2 (8 ÷ 4 = 2)
- No entry doors: Max **2** display doors
- 2 front entries: Max **0** display doors

## Backend Validation (Already Correct)

The backend in `pricing.py` lines 114-121 already had the correct validation:

```python
front_segment_count = max(1, round(normalized_dims["width"] / PANEL_SEGMENT_FT))
front_entry_count = len({d for d in entry_doors if d.startswith("front-")})
if display_doors + front_entry_count > front_segment_count:
    raise ConfigurationError(
        "Too many front-wall doors for the selected width: "
        f"{display_doors} display + {front_entry_count} front entry doors "
        f"exceeds {front_segment_count} available panel segments."
    )
```

## Testing

All test cases pass:
- ✅ 30ft width, no entry doors → max 6 display
- ✅ 30ft width, 1 front entry → max 6 display (still capped at 6)
- ✅ 30ft width, 2 front entries → max 6 display
- ✅ 12ft width, no entry doors → max 3 display
- ✅ 12ft width, 1 front entry → max 2 display
- ✅ 8ft width, no entry doors → max 2 display
- ✅ 8ft width, 2 front entries → max 0 display

## User Experience

**Before:**
1. User selects 30ft width
2. User can click "+" button to add 12+ display doors
3. Model shows too many doors
4. Backend rejects quote submission

**After:**
1. User selects 30ft width
2. "+" button automatically stops at 6 doors (or segment count if less than 6)
3. If user reduces width, display doors auto-reduce to fit
4. Model always shows valid configuration
5. Backend validation passes

## Status
✅ **Fixed and tested**
- Frontend now matches backend validation logic
- Panel segment calculation is consistent (4ft segments)
- Door count auto-adjusts when width or entry doors change
- No breaking changes to existing features
