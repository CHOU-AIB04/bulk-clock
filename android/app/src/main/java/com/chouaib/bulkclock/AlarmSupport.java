package com.chouaib.bulkclock;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.Iterator;

/**
 * Shared plumbing for the full-screen reminders.
 *
 * Three jobs live here so the plugin, the alarm receiver and the boot receiver
 * all agree with each other:
 *
 *   1. Notification channels, one per kind of reminder, each with its own sound.
 *      A channel's sound is fixed the moment it is created and can never be
 *      changed, so the ids carry a version suffix — changing a sound in a future
 *      release means bumping that number, not editing the channel.
 *
 *   2. Choosing the strongest scheduling method the OS will currently allow.
 *
 *   3. Remembering scheduled alarms, because Android drops every alarm an app
 *      has set when the phone restarts and nothing re-arms them until the app is
 *      next opened — which for a reminder app is precisely too late.
 */
public final class AlarmSupport {

    public static final String PREFS = "bulkclock_alarms";
    public static final String KEY_ALARMS = "scheduled";
    public static final String KEY_PENDING = "pending_alarm";

    public static final String EXTRA_ID = "alarm_id";
    public static final String EXTRA_TITLE = "alarm_title";
    public static final String EXTRA_BODY = "alarm_body";
    public static final String EXTRA_KIND = "alarm_kind";
    public static final String EXTRA_EVENT = "alarm_event";
    public static final String EXTRA_FROM_ALARM = "from_alarm";

    private AlarmSupport() {}

    /* ── channels ────────────────────────────────────────── */

    /** Bump the suffix to change a sound; an existing channel keeps its old one. */
    private static final String SUFFIX = "_v1";

    public static String channelFor(String kind) {
        if ("training".equals(kind)) return "alarm_training" + SUFFIX;
        if ("checkin".equals(kind)) return "alarm_checkin" + SUFFIX;
        return "alarm_meal" + SUFFIX;
    }

    private static int soundFor(String kind) {
        if ("training".equals(kind)) return R.raw.alarm_training;
        if ("checkin".equals(kind)) return R.raw.alarm_checkin;
        return R.raw.alarm_meal;
    }

    public static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;

        createChannel(context, nm, "meal", "Meal reminders",
                "Takes over the screen when a meal is due");
        createChannel(context, nm, "training", "Training reminders",
                "Takes over the screen when a session is due");
        createChannel(context, nm, "checkin", "Daily check-in",
                "The evening review of what actually happened");
    }

    private static void createChannel(Context context, NotificationManager nm,
                                      String kind, String name, String description) {
        String id = channelFor(kind);
        if (nm.getNotificationChannel(id) != null) return;

        NotificationChannel channel = new NotificationChannel(id, name, NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription(description);
        channel.enableVibration(true);
        channel.setVibrationPattern(
                "training".equals(kind)
                        ? new long[]{0, 350, 180, 350, 180, 520}
                        : new long[]{0, 240, 160, 380});
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        channel.setBypassDnd(false);

        Uri sound = Uri.parse("android.resource://" + context.getPackageName() + "/" + soundFor(kind));
        AudioAttributes attrs = new AudioAttributes.Builder()
                // Alarm usage so it plays at alarm volume rather than being lost
                // under a phone that is on vibrate for notifications.
                .setUsage("checkin".equals(kind)
                        ? AudioAttributes.USAGE_NOTIFICATION
                        : AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
        channel.setSound(sound, attrs);

        nm.createNotificationChannel(channel);
    }

    /* ── scheduling ──────────────────────────────────────── */

    public static boolean canScheduleExact(Context context) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return am.canScheduleExactAlarms();
        return true;
    }

    /**
     * Set one alarm, using the strongest method currently permitted.
     *
     * `setAlarmClock` is the only tier Doze never defers, and it puts an alarm
     * icon in the status bar so the user can see something is armed. If exact
     * alarms have been refused, an inexact window is still far better than
     * nothing — the reminder arrives late rather than never.
     */
    public static void setAlarm(Context context, int id, long at, String title, String body,
                                String kind, String eventId) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;

        Intent intent = new Intent(context, AlarmReceiver.class)
                .setAction("com.chouaib.bulkclock.FIRE")
                .putExtra(EXTRA_ID, id)
                .putExtra(EXTRA_TITLE, title)
                .putExtra(EXTRA_BODY, body)
                .putExtra(EXTRA_KIND, kind)
                .putExtra(EXTRA_EVENT, eventId);

        PendingIntent fire = PendingIntent.getBroadcast(
                context, id, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        if (canScheduleExact(context)) {
            PendingIntent show = PendingIntent.getActivity(
                    context, id + 90000, launchIntent(context, kind, eventId),
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(at, show), fire);
        } else {
            // Ten-minute window: close enough to be useful, loose enough that the
            // OS will still deliver it without the exact-alarm permission.
            am.setWindow(AlarmManager.RTC_WAKEUP, at, 10 * 60 * 1000L, fire);
        }

        remember(context, id, at, title, body, kind, eventId);
    }

    public static void cancelAlarm(Context context, int id) {
        cancelOnly(context, id);
        forget(context, id);
    }

    /**
     * Cancel the alarm without touching the stored list.
     *
     * Bulk cancellation goes through here and writes the list once at the end —
     * a SharedPreferences commit per id turns clearing a couple of hundred
     * alarms into a visible stall on app launch.
     */
    private static void cancelOnly(Context context, int id) {
        AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Intent intent = new Intent(context, AlarmReceiver.class).setAction("com.chouaib.bulkclock.FIRE");
        PendingIntent fire = PendingIntent.getBroadcast(
                context, id, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (am != null) am.cancel(fire);
        fire.cancel();
    }

    public static void cancelRange(Context context, int from, int to) {
        for (int id = from; id <= to; id++) cancelOnly(context, id);

        JSONObject store = all(context);
        for (int id = from; id <= to; id++) store.remove(String.valueOf(id));
        prefs(context).edit().putString(KEY_ALARMS, store.toString()).apply();
    }

    public static Intent launchIntent(Context context, String kind, String eventId) {
        return new Intent(context, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra(EXTRA_FROM_ALARM, true)
                .putExtra(EXTRA_KIND, kind)
                .putExtra(EXTRA_EVENT, eventId);
    }

    /* ── remembering what is armed ───────────────────────── */

    public static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static JSONObject all(Context context) {
        try {
            return new JSONObject(prefs(context).getString(KEY_ALARMS, "{}"));
        } catch (JSONException e) {
            return new JSONObject();
        }
    }

    private static void remember(Context context, int id, long at, String title, String body,
                                 String kind, String eventId) {
        try {
            JSONObject store = all(context);
            JSONObject entry = new JSONObject();
            entry.put("at", at);
            entry.put("title", title);
            entry.put("body", body);
            entry.put("kind", kind);
            entry.put("event", eventId == null ? "" : eventId);
            store.put(String.valueOf(id), entry);
            prefs(context).edit().putString(KEY_ALARMS, store.toString()).apply();
        } catch (JSONException ignored) {
            // A failure here costs re-arming after a reboot, not the alarm itself.
        }
    }

    public static void forget(Context context, int id) {
        JSONObject store = all(context);
        store.remove(String.valueOf(id));
        prefs(context).edit().putString(KEY_ALARMS, store.toString()).apply();
    }

    public static void forgetAll(Context context) {
        prefs(context).edit().putString(KEY_ALARMS, "{}").apply();
    }

    /** Re-arm everything still in the future. Called after a reboot. */
    public static int rearmAll(Context context) {
        JSONObject store = all(context);
        long now = System.currentTimeMillis();
        int armed = 0;

        for (Iterator<String> it = store.keys(); it.hasNext(); ) {
            String key = it.next();
            JSONObject entry = store.optJSONObject(key);
            if (entry == null) continue;

            long at = entry.optLong("at", 0);
            if (at <= now) continue;

            try {
                setAlarm(context, Integer.parseInt(key), at,
                        entry.optString("title"), entry.optString("body"),
                        entry.optString("kind"), entry.optString("event"));
                armed++;
            } catch (NumberFormatException ignored) {
                // A key that is not an int cannot have come from us.
            }
        }
        return armed;
    }
}
