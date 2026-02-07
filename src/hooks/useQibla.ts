import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Motion } from '@capacitor/motion';
import { AthanPlugin } from '../plugins/athanPlugin';
import { calculateQiblaDirection } from '../services/prayerService';
import { useLocation } from '../context/LocationContext';

interface QiblaData {
  qiblaDirection: number; // Direction to Qibla from True North
  deviceHeading: number; // Current device heading (true north)
  rotationAngle: number; // How much to rotate the compass arrow
  isCalibrated: boolean;
  accuracy: number; // 0=unreliable, 1=low, 2=medium, 3=high
  error: string | null;
}

export function useQibla() {
  const { location } = useLocation();
  const [data, setData] = useState<QiblaData>({
    qiblaDirection: 0,
    deviceHeading: 0,
    rotationAngle: 0,
    isCalibrated: false,
    accuracy: 0,
    error: null,
  });
  const [isListening, setIsListening] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  // Calculate Qibla direction based on current location
  const qiblaDirection = calculateQiblaDirection(location.coordinates);

  const startListening = useCallback(async () => {
    if (isListening) return;

    try {
      const platform = Capacitor.getPlatform();

      if (platform === 'android') {
        // Android: use native SensorManager via AthanPlugin for accurate heading
        const listener = await AthanPlugin.addListener('compassHeading', (event) => {
          const heading = event.heading;
          const accuracy = event.accuracy ?? 0;
          const rotation = qiblaDirection - heading;

          setData({
            qiblaDirection,
            deviceHeading: heading,
            rotationAngle: rotation,
            isCalibrated: accuracy >= 2,
            accuracy,
            error: null,
          });
        });

        // Pass user coordinates so native layer can compute magnetic declination
        await AthanPlugin.startCompass({
          latitude: location.coordinates.latitude,
          longitude: location.coordinates.longitude,
        });

        cleanupRef.current = () => {
          listener.remove();
          AthanPlugin.stopCompass();
        };
      } else {
        // iOS: use Capacitor Motion plugin (webkitCompassHeading available)
        await Motion.addListener('orientation', (event) => {
          const compassHeading = (event as unknown as Record<string, number>).webkitCompassHeading;

          if (compassHeading !== undefined) {
            const heading = compassHeading;
            const rotation = qiblaDirection - heading;

            setData({
              qiblaDirection,
              deviceHeading: heading,
              rotationAngle: rotation,
              isCalibrated: true,
              accuracy: 3,
              error: null,
            });
          } else {
            // Fallback: alpha-based
            const raw = event.alpha ?? 0;
            const heading = (360 - raw) % 360;
            const rotation = qiblaDirection - heading;

            setData({
              qiblaDirection,
              deviceHeading: heading,
              rotationAngle: rotation,
              isCalibrated: true,
              accuracy: 1,
              error: null,
            });
          }
        });

        cleanupRef.current = () => {
          Motion.removeAllListeners();
        };
      }

      setIsListening(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to access motion sensors';
      setData((prev) => ({
        ...prev,
        error: message,
        isCalibrated: false,
      }));
    }
  }, [isListening, qiblaDirection, location.coordinates.latitude, location.coordinates.longitude]);

  const stopListening = useCallback(async () => {
    if (!isListening) return;

    try {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      setIsListening(false);
    } catch (err) {
      console.error('Failed to stop motion listener:', err);
    }
  }, [isListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  return {
    ...data,
    qiblaDirection,
    isListening,
    startListening,
    stopListening,
  };
}
