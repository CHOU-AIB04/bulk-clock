# Native Android: reminders and activity recording

Two things in this app cannot be done from the web layer, so they are written in
Java under `app/src/main/java/com/chouaib/bulkclock/`.

---

## 1. Full-screen reminders — `FullScreenAlarm`

Capacitor's notification plugin cannot take over a locked screen. That needs
Android's `fullScreenIntent`, a per-notification flag it does not expose. So the
on-time reminder is scheduled by a small plugin instead.

| File | What it does |
| --- | --- |
| `FullScreenAlarm.java` | The plugin the web layer calls: schedule, cancel, permission checks, settings deep links |
| `AlarmSupport.java` | Notification channels, choosing the strongest scheduling tier, remembering what is armed |
| `AlarmReceiver.java` | Fires when a reminder is due and posts the notification with `setFullScreenIntent` |
| `BootReceiver.java` | Re-arms everything after a restart, because Android drops all alarms on reboot |
| `MainActivity.java` | Shows itself over the lock screen, but **only** when launched by an alarm |

### The two layers of reminder

- **Thirty minutes ahead** — an ordinary heads-up notification with Ate it /
  Snooze / Skipped buttons, from `@capacitor/local-notifications`. Easy to ignore.
- **At the moment itself** — a real alarm from this plugin. Its own sound, and it
  takes over the screen with the phone locked in a pocket.

### Sounds

`android/tools/make-sounds.py` generates three WAVs into `res/raw`:

| File | Character |
| --- | --- |
| `alarm_meal.wav` | Warm rising third — an invitation |
| `alarm_training.wav` | Three low pulses then an octave — gets you off the sofa |
| `alarm_checkin.wav` | Quiet two-note, easy to ignore on purpose |

A notification channel's sound is fixed when the channel is created and can never
be changed. To change a sound, edit the generator **and** bump `SUFFIX` in
`AlarmSupport.java` — otherwise existing installs keep the old one for ever.

### Permissions this depends on

| Permission | Why | If refused |
| --- | --- | --- |
| `SCHEDULE_EXACT_ALARM` | Reminders land on the minute | Falls back to a ten-minute window |
| `USE_FULL_SCREEN_INTENT` | Taking over the lock screen | Falls back to a heads-up card |
| `POST_NOTIFICATIONS` | Anything at all | Nothing arrives |
| `RECEIVE_BOOT_COMPLETED` | Surviving a restart | Reminders stop until the app is opened |

**Before submitting to Play**, reconsider `USE_EXACT_ALARM` in the manifest. It is
auto-granted, but policy restricts it to apps whose core function is alarms or
calendars. `SCHEDULE_EXACT_ALARM` is the safe one — the user grants it, and
Settings → Reminders has a button that opens the right screen.

---

## 2. Activity recording — `LiveActivity`

| File | What it does |
| --- | --- |
| `LiveActivity.java` | The plugin: start, update, stop |
| `LiveActivityService.java` | Foreground service, the lock-screen card, and the wake lock |

Android stops delivering GPS fixes and eventually freezes the process once an app
goes to the background. A foreground service prevents both, and it must show a
permanent notification — which is exactly the card showing time and distance.

The **wake lock** is the part with a real cost. Without it the CPU sleeps between
fixes and the JavaScript that accumulates the track stops running, so an hour-long
run records about four minutes. It is held only while recording, capped at eight
hours, and released the moment the activity stops.

All the tracking maths — distance, pace, splits, elevation, calories — lives in
`src/lib/activity.js` and is covered by tests. The service does no computation.

---

## Building

There is no Android SDK in the development container, so the Java here is
compiled by CI:

```bash
git push          # .github/workflows/android.yml builds the APK
```

A compile error shows up in the Actions log with a file and line. To build
locally you need Android Studio or the command-line tools, then:

```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
```

---

## Testing it on a real phone

1. Install the APK and open the app once, so the alarms get armed.
2. **Settings → Reminders** shows what the OS is currently allowing: exact
   alarms, full-screen intent, battery optimisation. Fix anything marked amber.
3. Tap **Test a meal alarm** or **Test a training alarm**, then *lock the phone
   immediately*. Ten seconds later it should light up, take over the screen, and
   play that kind's sound.
4. For activities: **Training → Activity → Start an activity**, pick Walk, allow
   location, then lock the phone and walk for a few minutes. The lock screen
   should show a card with the time and distance climbing.

If the takeover does not appear but the sound plays, the full-screen permission
was refused — that is the Android 14 grant, and the button in Settings opens it.
