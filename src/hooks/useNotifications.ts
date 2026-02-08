import { useEffect, useCallback } from 'react';
import { scheduleNotifications, scheduleJumuahNotifications, scheduleSurahKahfNotifications, setupNotificationListeners } from '../services/notificationService';
import { useSettings } from '../context/SettingsContext';
import { useLocation } from '../context/LocationContext';

export function useNotifications() {
  const { settings } = useSettings();
  const { location } = useLocation();

  // Schedule prayer notifications whenever location or settings change
  const reschedule = useCallback(async () => {
    await scheduleNotifications(location.coordinates, settings);
  }, [location.coordinates, settings]);

  // Schedule Jumuah notifications when settings change
  const rescheduleJumuah = useCallback(async () => {
    await scheduleJumuahNotifications(settings.jumuah);
  }, [settings.jumuah]);

  // Schedule Surah Kahf notifications when location or settings change
  const rescheduleSurahKahf = useCallback(async () => {
    await scheduleSurahKahfNotifications(
      location.coordinates,
      settings.surahKahf,
      settings.calculationMethod,
      settings.asrCalculation,
    );
  }, [location.coordinates, settings.surahKahf, settings.calculationMethod, settings.asrCalculation]);

  useEffect(() => {
    reschedule();
  }, [reschedule]);

  useEffect(() => {
    rescheduleJumuah();
  }, [rescheduleJumuah]);

  useEffect(() => {
    rescheduleSurahKahf();
  }, [rescheduleSurahKahf]);

  // Set up notification click listener
  useEffect(() => {
    const cleanup = setupNotificationListeners((prayerName) => {
      console.log(`Notification clicked for: ${prayerName}`);
    });

    return cleanup;
  }, []);

  return { reschedule, rescheduleJumuah, rescheduleSurahKahf };
}
