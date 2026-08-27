package com.chouaib.bulkclock;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Android throws away every alarm an app has set when the phone restarts, and
 * nothing re-arms them until the app is next opened — which, for an app whose
 * entire job is to open itself at the right moment, is exactly too late.
 *
 * This re-arms everything still in the future the moment the phone finishes
 * booting.
 */
public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;

        boolean relevant = Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
                || "android.intent.action.QUICKBOOT_POWERON".equals(action)
                // Some Chinese ROMs use their own, undocumented broadcast.
                || "com.htc.intent.action.QUICKBOOT_POWERON".equals(action);
        if (!relevant) return;

        AlarmSupport.ensureChannels(context);
        AlarmSupport.rearmAll(context);
    }
}
