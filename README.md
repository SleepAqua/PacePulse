# PacePulse

PacePulse is a lightweight workout app for HIIT and Muscle Training. It runs offline and stores your workout history locally so you keep control of your data.

Important: this project is now shipped as an app (native wrapper via Capacitor or as an installed web app) — it's no longer focused on being distributed as a PWA-only experience.

## What it does

- HIIT Timer: configurable exercise/rest intervals and loop counts
- Muscle Training: log sets and reps, automatic rest countdown between sets
- Miscellaneous mode: works like HIIT but does not record the workout in history
- Audio rewards: upload audio files or folders; plays a random reward clip when a session finishes
- Pause/Resume: pause timers and countdown voice; pause and resume reward playback
- Workout history: view saved workouts by date and aggregated stats for the last 30 days

## Quick use

1. Open the app (in a browser or the installed app on your device)
2. Pick a mode (`HIIT`, `Muscle Training`, or `Miscellaneous`)
3. Configure minutes and seconds for exercise/rest
4. (Optional) Upload audio files or an entire folder in the Audio panel
5. Tap `Start` to begin; use `Pause` during rest if needed
6. View results in `History` (excluded for `Miscellaneous` mode)

## Installing on Android (for developers)

Build and open with Capacitor or simply install the app from the browser if supported:

```bash
npm run build
npm run cap:copy
npm run cap:open
```

## Privacy & offline

- All workout history and uploaded audio are stored locally on your device using IndexedDB. Nothing is uploaded by default.
- Works offline after installation.

## Version log (summary of recent edits)

- v1.0 — Added `Miscellaneous` mode (HIIT behavior without history); added folder upload support for audio; updated UI and README
- v0.4 — Implemented workout history with calendar view; added IndexedDB persistence for uploaded audio; added pause/resume controls and countdown voice fallback
- v0.3 — Improved audio playback controls (play/pause/resume), added reward audio selection and randomization
- v0.2 — Switched minute/second inputs for timers; fixed HIIT loop transitions and rest countdown logic
- v0.1 — Initial scaffold: React + TypeScript + Vite; basic HIIT and Muscle Training timers

## Notes & troubleshooting

- Folder upload works in Chrome on desktop and many modern browsers; some browsers may not support directory selection.
- If audio playback doesn't work, check browser permissions and ensure the files are in a supported format (e.g., MP3, WAV).