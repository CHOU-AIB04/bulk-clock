package com.chouaib.bulkclock;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Reminders that take over a locked screen.
 *
 * Capacitor's own notification plugin cannot do this: `fullScreenIntent` is a
 * per-notification flag it does not expose, and it is the only way Android lets
 * an app show something over the lock screen. Everything else here — exact
 * alarms, per-kind sounds, re-arming after a reboot — follows from wanting that
 * one flag to work reliably.
 *
 * The web layer keeps deciding *what* to remind about and *when*; this only
 * carries it out.
 */
@CapacitorPlugin(name = "FullScreenAlarm")
public class FullScreenAlarm extends Plugin {

    @PluginMethod
    public void schedule(PluginCall call) {
        Integer id = call.getInt("id");
        String at = call.getString("at");           // epoch ms as a string — JS numbers are doubles
        String title = call.getString("title", "Bulk Clock");
        String body = call.getString("body", "");
        String kind = call.getString("kind", "meal");
        String event = call.getString("event", "");

        if (id == null || at == null) {
            call.reject("id and at are required");
            return;
        }

        long when;
        try {
            when = Long.parseLong(at);
        } catch (NumberFormatException e) {
            call.reject("at must be epoch milliseconds");
            return;
        }

        if (when <= System.currentTimeMillis()) {
            // Refusing quietly rather than firing immediately: an alarm for a
            // moment that has passed is a bug in the caller, not a reminder.
            JSObject skipped = new JSObject();
            skipped.put("scheduled", false);
            skipped.put("reason", "in the past");
            call.resolve(skipped);
            return;
        }

        Context context = getContext();
        AlarmSupport.ensureChannels(context);
        AlarmSupport.setAlarm(context, id, when, title, body, kind, event);

        JSObject result = new JSObject();
        result.put("scheduled", true);
        result.put("exact", AlarmSupport.canScheduleExact(context));
        call.resolve(result);
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        Integer id = call.getInt("id");
        if (id == null) {
            call.reject("id is required");
            return;
        }
        AlarmSupport.cancelAlarm(getContext(), id);
        call.resolve();
    }

    @PluginMethod
    public void cancelRange(PluginCall call) {
        Integer from = call.getInt("from");
        Integer to = call.getInt("to");
        if (from == null || to == null) {
            call.reject("from and to are required");
            return;
        }
        AlarmSupport.cancelRange(getContext(), from, to);
        call.resolve();
    }

    /* ── permissions the OS can refuse ───────────────────── */

    /**
     * Named `status` rather than `checkPermissions`, which is a real method on
     * Capacitor's Plugin base class — overriding it would quietly replace the
     * framework's own permission handling with this.
     */
    @PluginMethod
    public void status(PluginCall call) {
        Context context = getContext();
        JSObject result = new JSObject();
        result.put("exactAlarms", AlarmSupport.canScheduleExact(context));
        result.put("fullScreen", canUseFullScreen());
        result.put("batteryUnrestricted", isIgnoringBatteryOptimizations());
        call.resolve(result);
    }

    private boolean canUseFullScreen() {
        // Android 14 made this a runtime grant, and only auto-grants it to alarm
        // and calling apps. Everything else has to ask.
        if (Build.VERSION.SDK_INT < 34) return true;
        try {
            android.app.NotificationManager nm =
                    getContext().getSystemService(android.app.NotificationManager.class);
            return nm != null && nm.canUseFullScreenIntent();
        } catch (Throwable t) {
            return false;
        }
    }

    private boolean isIgnoringBatteryOptimizations() {
        try {
            android.os.PowerManager pm =
                    (android.os.PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            return pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        } catch (Throwable t) {
            return false;
        }
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            open(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                    Uri.parse("package:" + getContext().getPackageName())));
        }
        call.resolve();
    }

    @PluginMethod
    public void openFullScreenSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 34) {
            open(new Intent("android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT",
                    Uri.parse("package:" + getContext().getPackageName())));
        } else {
            openAppSettings();
        }
        call.resolve();
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        // Deliberately the list rather than the direct request dialog: Play
        // policy is strict about apps demanding an exemption, and the list lets
        // the user see what they are agreeing to.
        try {
            open(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        } catch (Throwable t) {
            openAppSettings();
        }
        call.resolve();
    }

    private void openAppSettings() {
        open(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.parse("package:" + getContext().getPackageName())));
    }

    private void open(Intent intent) {
        try {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        } catch (Throwable ignored) {
            // Some manufacturers remove these screens entirely.
        }
    }

    /* ── which reminder opened the app ───────────────────── */

    /**
     * Returns and clears the reminder that launched the app, so the web layer
     * can open straight onto it. Empty when the app was opened by hand.
     */
    @PluginMethod
    public void consumePending(PluginCall call) {
        String pending = AlarmSupport.prefs(getContext())
                .getString(AlarmSupport.KEY_PENDING, "");
        AlarmSupport.prefs(getContext()).edit().remove(AlarmSupport.KEY_PENDING).apply();

        JSObject result = new JSObject();
        if (pending.isEmpty()) {
            result.put("event", "");
            result.put("kind", "");
        } else {
            String[] parts = pending.split("\\|", 2);
            result.put("event", parts[0]);
            result.put("kind", parts.length > 1 ? parts[1] : "");
        }
        call.resolve(result);
    }

    /** Fire one in a few seconds, so the whole path can be tested on a real phone. */
    @PluginMethod
    public void test(PluginCall call) {
        String kind = call.getString("kind", "meal");
        int seconds = call.getInt("seconds", 10);

        Context context = getContext();
        AlarmSupport.ensureChannels(context);
        AlarmSupport.setAlarm(context, 99001,
                System.currentTimeMillis() + seconds * 1000L,
                "training".equals(kind) ? "Lower — heavy" : "Lunch",
                "training".equals(kind)
                        ? "This is what a session reminder looks like. Lock the phone to see it take over."
                        : "This is what a meal reminder looks like. Lock the phone to see it take over.",
                kind, "test");
        call.resolve();
    }
}
