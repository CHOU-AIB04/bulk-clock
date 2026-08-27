package com.chouaib.bulkclock;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

/**
 * Keeps a run recording while the phone is in a pocket.
 *
 * Android stops handing an app GPS fixes, and eventually freezes its process
 * entirely, once it goes to the background — unless a foreground service is
 * running. That service must show a permanent notification, which is not a
 * side effect to be tolerated but exactly what the user asked for: the card on
 * the lock screen with the time and distance on it.
 *
 * The wake lock is the part with a real cost. Without it the CPU sleeps between
 * GPS fixes and the JavaScript timer that accumulates the track stops running,
 * so a one-hour run records about four minutes. It is acquired only while an
 * activity is being recorded and released the moment it stops.
 */
public class LiveActivityService extends Service {

    public static final String CHANNEL = "live_activity_v1";
    public static final int NOTIFICATION_ID = 4200;

    public static final String ACTION_START = "com.chouaib.bulkclock.LIVE_START";
    public static final String ACTION_UPDATE = "com.chouaib.bulkclock.LIVE_UPDATE";
    public static final String ACTION_STOP = "com.chouaib.bulkclock.LIVE_STOP";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_TEXT = "text";
    public static final String EXTRA_PAUSED = "paused";

    private PowerManager.WakeLock wakeLock;

    /**
     * Whether this service has already promoted itself to the foreground.
     *
     * Android gives a service started with `startForegroundService` about five
     * seconds to call `startForeground`, and kills the whole app if it does not.
     * An update arriving before a start — which happens whenever the system has
     * restarted the service, or the web layer refreshes the card first — used to
     * skip that call entirely.
     */
    private boolean inForeground = false;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? ACTION_START : intent.getAction();

        if (ACTION_STOP.equals(action)) {
            releaseWakeLock();
            inForeground = false;
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        String title = intent != null && intent.getStringExtra(EXTRA_TITLE) != null
                ? intent.getStringExtra(EXTRA_TITLE) : "Recording";
        String text = intent != null && intent.getStringExtra(EXTRA_TEXT) != null
                ? intent.getStringExtra(EXTRA_TEXT) : "";
        boolean paused = intent != null && intent.getBooleanExtra(EXTRA_PAUSED, false);

        ensureChannel();
        Notification notification = build(title, text, paused);

        if (!inForeground) {
            // Always, whatever the action. See the field comment above.
            startInForeground(notification);
            inForeground = true;
            acquireWakeLock();
        } else if (ACTION_START.equals(action)) {
            acquireWakeLock();
            update(notification);
        } else {
            update(notification);
        }

        // START_STICKY so Android brings the service back if it has to reclaim
        // memory mid-run; the track itself is persisted on the web side.
        return START_STICKY;
    }

    private void update(Notification notification) {
        NotificationManager nm =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIFICATION_ID, notification);
    }

    private void startInForeground(Notification notification) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            // Android 14 insists the service declares why it is running.
            startForeground(NOTIFICATION_ID, notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private Notification build(String title, String text, boolean paused) {
        Intent open = new Intent(this, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
                this, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_icon)
                .setContentTitle(title)
                .setContentText(text)
                .setContentIntent(contentIntent)
                .setOngoing(!paused)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setShowWhen(false)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_WORKOUT)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setUsesChronometer(false)
                .build();
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(CHANNEL) != null) return;

        // LOW: it must be visible on the lock screen and completely silent. A
        // card that pings every time the distance ticks over would be unusable.
        NotificationChannel channel = new NotificationChannel(
                CHANNEL, "Activity in progress", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("The card showing time and distance while you're recording");
        channel.setShowBadge(false);
        channel.enableVibration(false);
        channel.setSound(null, null);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(channel);
    }

    private void acquireWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) return;
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm == null) return;
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BulkClock:activity");
        // Bounded, so a recording that is never stopped cannot hold the CPU awake
        // for ever. Eight hours is longer than any session this app is for.
        wakeLock.acquire(8 * 60 * 60 * 1000L);
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (Throwable ignored) {
            // Releasing an already-released lock is not worth crashing over.
        }
        wakeLock = null;
    }

    @Override
    public void onDestroy() {
        releaseWakeLock();
        inForeground = false;
        super.onDestroy();
    }
}
