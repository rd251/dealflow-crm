
Add the same "Mangler notat" / "Notat" badge logic to `src/pages/Moetenotater.tsx` for consistency with the Dashboard.

## Plan

1. In `src/pages/Moetenotater.tsx`, for each meeting row:
   - Compute `hasNotes = !!m.moetenotater?.trim()`
   - Compute `meetingStarted = m.start_tid ? new Date(m.start_tid) < new Date() : new Date(m.dato) < new Date()`
   - Compute `missingNotes = meetingStarted && !hasNotes`
2. Render badges next to the meeting title/date:
   - `missingNotes` → red `destructive` badge with `AlertCircle` icon + "Mangler notat"
   - `hasNotes` → outline badge with `FileText` icon + "Notat"
   - Future meetings without notes → no badge (nothing to follow up yet)
3. Import `AlertCircle` and `FileText` from `lucide-react` if not already imported.
4. Keep existing selskap/salgsmulighet badges and clickable navigation untouched.

No database or schema changes. Pure UI consistency update.
