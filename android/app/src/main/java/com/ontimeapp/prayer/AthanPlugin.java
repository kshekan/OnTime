package com.ontimeapp.prayer;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.hardware.GeomagneticField;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "AthanPlugin")
public class AthanPlugin extends Plugin implements SensorEventListener {

    private MediaPlayer mediaPlayer;
    private SensorManager sensorManager;
    private Sensor accelerometer;
    private Sensor magnetometer;
    private boolean compassListening = false;
    private float[] gravity = null;
    private float[] geomagnetic = null;
    private final float[] rotationMatrix = new float[9];
    private final float[] remappedMatrix = new float[9];
    private final float[] orientation = new float[3];
    private float declination = 0f;
    private int magAccuracy = SensorManager.SENSOR_STATUS_UNRELIABLE;
    private static final float SENSOR_ALPHA = 0.2f;

    @PluginMethod
    public void startCompass(PluginCall call) {
        if (compassListening) {
            call.resolve();
            return;
        }

        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager == null) {
            call.reject("Sensor service not available");
            return;
        }

        // Compute magnetic declination from user's location
        float lat = call.getFloat("latitude", 0f);
        float lon = call.getFloat("longitude", 0f);
        if (lat != 0f || lon != 0f) {
            GeomagneticField geoField = new GeomagneticField(
                lat, lon, 0f, System.currentTimeMillis());
            declination = geoField.getDeclination();
        }

        gravity = null;
        geomagnetic = null;

        accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
        magnetometer = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);

        if (accelerometer == null || magnetometer == null) {
            call.reject("Required sensors not available on this device");
            return;
        }

        sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_UI);
        sensorManager.registerListener(this, magnetometer, SensorManager.SENSOR_DELAY_UI);
        compassListening = true;
        call.resolve();
    }

    @PluginMethod
    public void stopCompass(PluginCall call) {
        stopCompassListener();
        call.resolve();
    }

    private float[] lowPass(float[] input, float[] output) {
        if (output == null) return input.clone();
        for (int i = 0; i < input.length; i++) {
            output[i] = output[i] + SENSOR_ALPHA * (input[i] - output[i]);
        }
        return output;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_ACCELEROMETER) {
            gravity = lowPass(event.values, gravity);
        } else if (event.sensor.getType() == Sensor.TYPE_MAGNETIC_FIELD) {
            geomagnetic = lowPass(event.values, geomagnetic);
        }

        if (gravity != null && geomagnetic != null) {
            boolean success = SensorManager.getRotationMatrix(
                rotationMatrix, null, gravity, geomagnetic);

            if (success) {
                // Heading for phone held FLAT (screen up)
                SensorManager.getOrientation(rotationMatrix, orientation);
                float flatAzimuth = (float) Math.toDegrees(orientation[0]);
                float headingFlat = (flatAzimuth + declination + 360) % 360;
                float pitch = (float) Math.toDegrees(orientation[1]);

                // Heading for phone held UPRIGHT (screen facing user)
                SensorManager.remapCoordinateSystem(rotationMatrix,
                    SensorManager.AXIS_X, SensorManager.AXIS_Z, remappedMatrix);
                SensorManager.getOrientation(remappedMatrix, orientation);
                float uprightAzimuth = (float) Math.toDegrees(orientation[0]);
                float headingUpright = (uprightAzimuth + declination + 360) % 360;

                JSObject result = new JSObject();
                result.put("headingFlat", (double) headingFlat);
                result.put("headingUpright", (double) headingUpright);
                result.put("pitch", (double) pitch);
                result.put("declination", (double) declination);
                result.put("accuracy", magAccuracy);
                // Use flat heading as default for now
                result.put("heading", (double) headingFlat);
                notifyListeners("compassHeading", result);
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        if (sensor.getType() == Sensor.TYPE_MAGNETIC_FIELD) {
            magAccuracy = accuracy;
        }
    }

    private void stopCompassListener() {
        if (compassListening && sensorManager != null) {
            sensorManager.unregisterListener(this);
            compassListening = false;
        }
    }

    @Override
    protected void handleOnDestroy() {
        stopCompassListener();
        stopMediaPlayer();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void createAthanChannel(PluginCall call) {
        String channelId = call.getString("channelId");
        String channelName = call.getString("channelName");
        String soundFilePath = call.getString("soundFilePath");

        if (channelId == null || channelName == null || soundFilePath == null) {
            call.reject("channelId, channelName, and soundFilePath are required");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager)
                    getContext().getSystemService(Context.NOTIFICATION_SERVICE);

            File soundFile = new File(soundFilePath);
            if (!soundFile.exists()) {
                call.reject("Sound file not found: " + soundFilePath);
                return;
            }

            Uri soundUri = Uri.fromFile(soundFile);

            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();

            NotificationChannel channel = new NotificationChannel(
                    channelId, channelName, NotificationManager.IMPORTANCE_HIGH);
            channel.setSound(soundUri, audioAttributes);
            channel.enableVibration(true);
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

            manager.createNotificationChannel(channel);
        }

        call.resolve();
    }

    @PluginMethod
    public void deleteChannel(PluginCall call) {
        String channelId = call.getString("channelId");

        if (channelId == null) {
            call.reject("channelId is required");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager)
                    getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            manager.deleteNotificationChannel(channelId);
        }

        call.resolve();
    }

    @PluginMethod
    public void playPreview(PluginCall call) {
        String filePath = call.getString("filePath");

        if (filePath == null) {
            call.reject("filePath is required");
            return;
        }

        stopMediaPlayer();

        try {
            File file = new File(filePath);
            if (!file.exists()) {
                call.reject("File not found: " + filePath);
                return;
            }

            mediaPlayer = new MediaPlayer();
            mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build());
            mediaPlayer.setDataSource(file.getAbsolutePath());
            mediaPlayer.prepare();
            mediaPlayer.setOnCompletionListener(mp -> {
                stopMediaPlayer();
                JSObject result = new JSObject();
                notifyListeners("previewComplete", result);
            });
            mediaPlayer.start();
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to play preview: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopPreview(PluginCall call) {
        stopMediaPlayer();
        call.resolve();
    }

    @PluginMethod
    public void getExternalFilesDir(PluginCall call) {
        File dir = getContext().getExternalFilesDir(null);
        if (dir == null) {
            call.reject("External files directory not available");
            return;
        }

        JSObject result = new JSObject();
        result.put("path", dir.getAbsolutePath());
        call.resolve(result);
    }

    private void stopMediaPlayer() {
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
            } catch (Exception e) {
                // ignore
            }
            mediaPlayer = null;
        }
    }
}
