package com.chouaib.bulkclock;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.app.NotificationCompat;

/**
 * What happens when a reminder comes due.
 *
 * The notification carries a full-screen intent, which is the only mechanism
 * Android offers for taking over a locked screen. On a phone that is awake it
 * degrades by itself into a heads-up card, so the same code covers both.
 */
public class AlarmReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        int id = intent.getIntExtra(AlarmSupport.EXTRA_ID, 1);
        String title = intent.getStringExtra(AlarmSupport.EXTRA_TITLE);
        String body = intent.getStringExtra(AlarmSupport.EXTRA_BODY);
        String kind = intent.getStringExtra(AlarmSupport.EXTRA_KIND);
        String event = intent.getStringExtra(AlarmSupport.EXTRA_EVENT);

        if (title == null) title = "Bulk Clock";
        if (body == null) body = "";
        if (kind == null) kind = "meal";

        AlarmSupport.ensureChannels(context);

        // Remember which reminder woke the phone, so the app can open straight
        // onto that one rather than working it out again from the clock.
        AlarmSupport.prefs(context).edit()
                .putString(AlarmSupport.KEY_PENDING, (event == null ? "" : event) + "|" + kind)
                .apply();

        Intent launch = AlarmSupport.launchIntent(context, kind, event);
        PendingIntent contentIntent = PendingIntent.getActivity(
                context, id, launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder =
                new NotificationCompat.Builder(context, AlarmSupport.channelFor(kind))
                        .setSmallIcon(R.drawable.ic_stat_icon)
                        .setContentTitle(title)
                        .setContentText(body)
                        .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                        .setPriority(NotificationCompat.PRIORITY_MAX)
                        .setCategory(NotificationCompat.CATEGORY_ALARM)
                        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                        .setAutoCancel(true)
                        .setContentIntent(contentIntent)
                        // `true` means: if the screen is off or locked, launch the
                        // activity instead of showing a card. This is the line the
                        // whole plugin exists for.
                        .setFullScreenIntent(contentIntent, true);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            // Pre-Oreo there are no channels, so sound and vibration go on the
            // notification itself.
            builder.setSound(android.net.Uri.parse(
                    "android.resource://" + context.getPackageName() + "/"
                            + ("training".equals(kind) ? R.raw.alarm_training : R.raw.alarm_meal)));
            builder.setVibrate(new long[]{0, 300, 180, 400});
        }

        NotificationManager nm =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            try {
                nm.notify(id, builder.build());
            } catch (SecurityException ignored) {
                // Notification permission was revoked between scheduling and firing.
            }
        }

        // One-shot: it has fired, so it should not be re-armed after a reboot.
        AlarmSupport.forget(context, id);
    }
}
