package com.pacepulse.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.CountDownTimer;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class TimerService extends Service {
    public static final String CHANNEL_ID = "TimerServiceChannel";
    public static final String ACTION_START = "START_TIMER";
    public static final String ACTION_STOP = "STOP_SERVICE";
    public static final String EXTRA_SECONDS = "EXTRA_SECONDS";
    public static final String EXTRA_PHASE = "EXTRA_PHASE";

    private CountDownTimer countDownTimer;
    private NotificationManager notificationManager;

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;
        
        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopTimer();
            stopForeground(true);
            stopSelf();
            return START_NOT_STICKY;
        }

        if (ACTION_START.equals(action)) {
            int seconds = intent.getIntExtra(EXTRA_SECONDS, 0);
            String phase = intent.getStringExtra(EXTRA_PHASE);
            startTimer(seconds, phase);
        }

        return START_NOT_STICKY;
    }

    private void startTimer(int seconds, final String phase) {
        stopTimer();
        
        updateNotification(seconds, phase);
        startForeground(1, buildNotification(seconds, phase));

        countDownTimer = new CountDownTimer(seconds * 1000L, 1000) {
            public void onTick(long millisUntilFinished) {
                int secs = (int) (millisUntilFinished / 1000);
                updateNotification(secs, phase);
            }

            public void onFinish() {
                updateNotification(0, phase);
            }
        }.start();
    }

    private void stopTimer() {
        if (countDownTimer != null) {
            countDownTimer.cancel();
            countDownTimer = null;
        }
    }

    private void updateNotification(int seconds, String phase) {
        notificationManager.notify(1, buildNotification(seconds, phase));
    }

    private Notification buildNotification(int seconds, String phase) {
        String timeStr = String.format("%d:%02d", seconds / 60, seconds % 60);
        String content = (phase != null ? phase : "Timer") + " remaining: " + timeStr;

        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this,
                0, notificationIntent, PendingIntent.FLAG_IMMUTABLE);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("PacePulse")
                .setContentText(content)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentIntent(pendingIntent)
                .setOnlyAlertOnce(true)
                .setOngoing(true)
                .build();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Timer Service Channel",
                    NotificationManager.IMPORTANCE_LOW
            );
            notificationManager.createNotificationChannel(serviceChannel);
        }
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopTimer();
        super.onDestroy();
    }
}
