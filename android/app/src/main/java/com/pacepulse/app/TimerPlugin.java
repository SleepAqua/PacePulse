package com.pacepulse.app;

import android.content.Intent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TimerPlugin")
public class TimerPlugin extends Plugin {

    @PluginMethod
    public void startService(PluginCall call) {
        int seconds = call.getInt("seconds", 0);
        String phase = call.getString("phase", "Exercise");
        
        Intent serviceIntent = new Intent(getContext(), TimerService.class);
        serviceIntent.setAction(TimerService.ACTION_START);
        serviceIntent.putExtra(TimerService.EXTRA_SECONDS, seconds);
        serviceIntent.putExtra(TimerService.EXTRA_PHASE, phase);
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            getContext().startForegroundService(serviceIntent);
        } else {
            getContext().startService(serviceIntent);
        }
        call.resolve();
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        Intent serviceIntent = new Intent(getContext(), TimerService.class);
        serviceIntent.setAction(TimerService.ACTION_STOP);
        getContext().startService(serviceIntent);
        call.resolve();
    }
}
