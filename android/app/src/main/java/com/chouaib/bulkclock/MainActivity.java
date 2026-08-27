package com.chouaib.bulkclock;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

/**
 * The app's single activity.
 *
 * It doubles as the screen a reminder takes over with, which is why it has to
 * know how to show itself over a locked phone. That is deliberately conditional:
 * an app that sets `showWhenLocked` unconditionally would appear over the lock
 * screen every time it was opened, which is both alarming and a security
 * problem.
 *
 * The keyguard is never dismissed. The reminder shows on top of it, the buttons
 * work, and anything that would reveal the rest of the app still needs the phone
 * unlocked.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FullScreenAlarm.class);
        registerPlugin(LiveActivity.class);
        super.onCreate(savedInstanceState);

        AlarmSupport.ensureChannels(this);
        applyLockScreenMode(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        applyLockScreenMode(intent);
    }

    private void applyLockScreenMode(Intent intent) {
        boolean fromAlarm = intent != null
                && intent.getBooleanExtra(AlarmSupport.EXTRA_FROM_ALARM, false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(fromAlarm);
            setTurnScreenOn(fromAlarm);
        } else {
            int flags = WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON;
            if (fromAlarm) getWindow().addFlags(flags);
            else getWindow().clearFlags(flags);
        }

        if (!fromAlarm) return;

        // Wake the display. Without this the notification fires, the activity
        // starts, and the user finds it later with a dark screen.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null && !km.isKeyguardSecure()) {
                // Only dismiss an insecure keyguard — a PIN or fingerprint is
                // never worth prompting for to answer "did you eat lunch".
                km.requestDismissKeyguard(this, null);
            }
        }
    }
}
