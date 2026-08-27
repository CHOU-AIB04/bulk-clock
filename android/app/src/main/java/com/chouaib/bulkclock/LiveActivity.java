package com.chouaib.bulkclock;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The web layer's handle on the recording service.
 *
 * Everything about the activity — the track, the maths, when it starts and
 * stops — lives in JavaScript. This exists only to keep the process alive and to
 * put the numbers on the lock screen.
 */
@CapacitorPlugin(name = "LiveActivity")
public class LiveActivity extends Plugin {

    @PluginMethod
    public void start(PluginCall call) {
        send(LiveActivityService.ACTION_START,
                call.getString("title", "Recording"),
                call.getString("text", ""),
                false);
        call.resolve(supported());
    }

    @PluginMethod
    public void update(PluginCall call) {
        send(LiveActivityService.ACTION_UPDATE,
                call.getString("title", "Recording"),
                call.getString("text", ""),
                Boolean.TRUE.equals(call.getBoolean("paused", false)));
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        send(LiveActivityService.ACTION_STOP, null, null, false);
        call.resolve();
    }

    private JSObject supported() {
        JSObject result = new JSObject();
        result.put("supported", true);
        return result;
    }

    private void send(String action, String title, String text, boolean paused) {
        Intent intent = new Intent(getContext(), LiveActivityService.class).setAction(action);
        if (title != null) intent.putExtra(LiveActivityService.EXTRA_TITLE, title);
        if (text != null) intent.putExtra(LiveActivityService.EXTRA_TEXT, text);
        intent.putExtra(LiveActivityService.EXTRA_PAUSED, paused);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    && !LiveActivityService.ACTION_STOP.equals(action)) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
        } catch (Throwable ignored) {
            // Starting a foreground service from the background is restricted on
            // newer Android. The recording still works while the app is open.
        }
    }
}
