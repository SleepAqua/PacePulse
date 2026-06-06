# PacePulse

PacePulse is a compact workout app for HIIT and muscle training. It works offline and stores workout history locally so your data stays on your device.

This repository ships as a native wrapper using Capacitor (Android) or as an installable web app. It is no longer focused solely on a PWA distribution.

## Features
- HIIT Timer: configurable exercise/rest intervals and loop counts
- Muscle Training: log sets and reps, with an automatic rest countdown between sets
- Just a timer: a lightweight timer mode for ad-hoc timing (does not record history)
- Workout history: view saved workouts by date and see aggregated stats for the last 30 days
- Audio rewards: upload audio files or folders; the app plays a random reward clip when a session completes

## Quick start
1. Open the app in a browser or on your device (installed web app / Capacitor wrapper)
2. Choose a mode (`HIIT`, `Muscle Training`, or `Just a timer`)
3. Configure minutes and seconds for exercise/rest
4. (Optional) Upload audio files or a folder in the Audio panel
5. Tap `Start` to begin; use `Pause` during rest when needed
6. View results in `History` (sessions from `Just a timer` are not recorded)

## Privacy & offline
- All workout history and uploaded audio are stored locally using IndexedDB. Nothing is uploaded by default.
- The app works offline after installation.

 ## Changelog
 ### v1.6
 - When running in the background, the app shows the remaining time in the notification bar

### v1.5
 - Ensure consecutive HIIT moves are from different categories to avoid repeating the same muscle group across loops
 - Minor fixes and improvements to HIIT move selection and timer resilience

### v1.6.1
- Fix: `Just A Timer` no longer displays HIIT moves; only `HIIT` mode shows moves
- UI: renaming display label to `Just A Timer` (capital "A")

### v1.4
- HIIT selection improved: next move will not be from the same category as the previous move
- Defaults updated: HIIT loops default to 20; Just a Timer loops default to 4; exercise default 2:00; rest default 0:00
- UI text update: in Just a Timer mode, `Exercise` -> `Do something`, and `Start Timer` -> `Start`

### v1.3
 - Random HIIT moves: HIIT mode now shows a randomized move each exercise loop to vary workouts
 - Documentation and UI polish

### v1.2
 - Background-running support: timers compensate for time spent while the app is backgrounded or hidden
 - UI polish: `Miscellaneous` mode now displays as **Just a timer** and its start button reads **Start Timer**
 - Calendar view: reduced calendar cell sizes so the history calendar fits better on narrow screens
- Background-running support: timers compensate for time spent while the app is backgrounded or hidden
- UI polish: `Miscellaneous` mode now displays as **Just a timer** and its start button reads **Start Timer**
- Calendar view: reduced calendar cell sizes so the history calendar fits better on narrow screens

### HIIT exercise pool
The app selects a random move at the start of each exercise interval from this pool:

Cardio
- Jumping Jacks
- High Knees
- Butt Kicks
- Skater Hops
- Burpees
- Mountain Climbers
- Jump Rope
- Lateral Shuffles
- Speed Squats
- Star Jumps
- Squat Jumps

Lower Body
- Air Squats
- Split Squats
- Reverse Lunges
- Walking Lunges
- Jump Lunges
- Wall Sit
- Single-Leg Squats
- Calf Raises
- Glute Bridges
- Step-Ups

Upper Body
- Push-Ups
- Incline Push-Ups
- Diamond Push-Ups
- Pike Push-Ups
- Triceps Dips
- Shoulder Taps
- Arm Circles
- Plank Up-Downs

Core
- Plank
- Side Plank
- Dead Bug
- Hollow Hold
- Russian Twists
- Bicycle Crunches
- Leg Raises
- Flutter Kicks
- V-Ups
- Bear Crawl Hold

Full Body
- Bear Crawls
- Crab Walks
- Inchworms
- Turkish Get-Up
- Thrusters
- Walkout Push-Ups
- Burpee Broad Jumps

### v1.1
- Allow users to upload a folder of audio files
- Incognito mode: optional mode that avoids recording workout history

### v1.0
- Packaged as an Android app via Capacitor

### v0.4
- Implemented workout history with calendar view
- Added IndexedDB persistence for uploaded audio
- Added pause/resume controls and countdown voice fallback

### Earlier
- Various improvements to audio playback, timers, and UI

## Building for Android (developer)
Prerequisites: Node.js, npm, Java JDK, Android Studio / SDK installed.

To build and run locally:
```bash
npm install
npm run build
npm run cap:copy
npm run cap:open
```

To produce an Android App Bundle (AAB) or APK from the Android project:
```bash
# From the project root
npm run build
npm run cap:copy
# then build in the android folder
cd android
# build an AAB
./gradlew.bat bundleRelease
# build an unsigned release APK
./gradlew.bat assembleRelease
```

The outputs will be in `android/app/build/outputs/`:
- App Bundle: `bundle/release/*.aab`
- APK: `apk/release/*.apk`

## Notes & troubleshooting
- Folder upload works in Chrome and most modern browsers; browser support for directory selection varies.
- If audio playback fails, check file formats (MP3/WAV) and browser permissions.
- For build errors on Android, ensure Android SDKs and Java are correctly installed and configured.

If you'd like, I can run the build steps now and produce the AAB/APK on this machine.
