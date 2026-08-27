# Full-screen reminders

## What already works, with no native code

The app ships two layers of reminder, both built entirely in the web layer:

1. **Heads-up notifications.** Every meal and session fires twice — once at your
   lead time (30 minutes by default) and once at the moment itself. The Android
   channels for both are created at `IMPORTANCE_HIGH` (5) with vibration, which
   is what makes Android show them as a card over whatever is on screen rather
   than a silent line in the shade. Each one carries **Ate it / Snooze /
   Skipped** buttons that are answered without opening the app.

2. **An in-app takeover.** When the app is opened — by tapping a notification,
   or by hand — and something is due within the lead window, the whole screen is
   given over to that one event: what it is, when it is, what it means for your
   day, and the two or three things you might do about it. This is the screen in
   `src/components/ReminderTakeover.jsx`.

Reminders for meals you have already logged or answered are cancelled for the
rest of the day, so nothing arrives after the fact.

## The one thing that needs native code

A true **lock-screen takeover** — the Google Calendar behaviour where the alert
appears over the lock screen with the phone still in your pocket — requires an
Android `fullScreenIntent`. Capacitor's `@capacitor/local-notifications` plugin
does not expose that field, so it cannot be set from JavaScript.

The manifest permission is already declared:

```xml
<uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
```

To go the rest of the way you would add a small Capacitor plugin in
`android/app/src/main/java/…` that builds its own `NotificationCompat.Builder`
with:

```java
builder.setFullScreenIntent(pendingIntent, true)
       .setCategory(NotificationCompat.CATEGORY_ALARM)
       .setPriority(NotificationCompat.PRIORITY_MAX);
```

and schedules it through `AlarmManager.setExactAndAllowWhileIdle`. The activity
that `pendingIntent` opens should set `setShowWhenLocked(true)` and
`setTurnScreenOn(true)`.

Two caveats worth knowing before you build it:

- On **Android 14+**, `USE_FULL_SCREEN_INTENT` is only granted automatically to
  apps whose core function is calling or alarms. Everything else has to send the
  user to `Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT` and ask. A fitness
  app will land in the second group, so the flow has to handle being refused.
- Google Play reviews full-screen-intent use. Meal reminders are a defensible
  case, but it is worth having the permission request explain itself in the app
  first.

Until that plugin exists, the heads-up card plus the in-app takeover is the
closest an unmodified Capacitor build gets — and on a phone that is in your hand,
it is close to identical.
