import { createContext, useContext, useMemo, useState, useEffect, useRef, type ReactNode } from 'react';
import { useSettings } from './SettingsContext';
import { useLocation } from './LocationContext';
import { calculateDistanceKm } from '../utils/distance';
import type { TravelState, HomeBaseLocation, TravelSettings } from '../types';

interface TravelContextType {
  travelState: TravelState;
  setHomeBase: (home: HomeBaseLocation) => void;
  clearHomeBase: () => void;
  setTravelOverride: (override: TravelSettings['override']) => void;
  toggleJama: (pair: 'dhuhrAsr' | 'maghribIsha') => void;
  toggleTravelEnabled: () => void;
  confirmTravel: () => void;
  dismissTravel: () => void;
}

const defaultTravelState: TravelState = {
  isTraveling: false,
  travelPending: false,
  distanceFromHomeKm: null,
  isAutoDetected: false,
  qasr: { dhuhr: false, asr: false, isha: false },
  jamaDhuhrAsr: false,
  jamaMaghribIsha: false,
};

const TravelContext = createContext<TravelContextType | null>(null);

export function TravelProvider({ children }: { children: ReactNode }) {
  const { settings, updateTravel } = useSettings();
  const { location } = useLocation();
  const [dismissed, setDismissed] = useState(false);

  // Track previous distance to auto-reset autoConfirmed when returning home
  const prevDistanceRef = useRef<number | null>(null);

  const travelState = useMemo<TravelState>(() => {
    const { travel } = settings;

    if (!travel.enabled || !travel.homeBase) {
      return defaultTravelState;
    }

    // Force overrides
    if (travel.override === 'force_off') {
      return defaultTravelState;
    }

    const distance = calculateDistanceKm(
      travel.homeBase.coordinates,
      location.coordinates,
    );

    let isTraveling = false;
    let isAutoDetected = false;
    let travelPending = false;

    if (travel.override === 'force_on') {
      isTraveling = true;
    } else {
      // Auto detection with confirmation
      const aboveThreshold = distance >= travel.distanceThresholdKm;
      if (aboveThreshold && travel.autoConfirmed) {
        isTraveling = true;
        isAutoDetected = true;
      } else if (aboveThreshold && !travel.autoConfirmed) {
        travelPending = !dismissed;
        isTraveling = false;
        isAutoDetected = false;
      }
    }

    // Check max travel days expiration
    if (isTraveling && travel.maxTravelDays > 0 && travel.travelStartDate) {
      const startDate = new Date(travel.travelStartDate);
      const now = new Date();
      const daysDiff = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > travel.maxTravelDays) {
        isTraveling = false;
      }
    }

    if (!isTraveling && !travelPending) {
      return {
        ...defaultTravelState,
        distanceFromHomeKm: distance,
      };
    }

    if (travelPending) {
      return {
        ...defaultTravelState,
        travelPending: true,
        distanceFromHomeKm: distance,
      };
    }

    return {
      isTraveling: true,
      travelPending: false,
      distanceFromHomeKm: distance,
      isAutoDetected,
      qasr: { dhuhr: true, asr: true, isha: true },
      jamaDhuhrAsr: travel.jamaDhuhrAsr,
      jamaMaghribIsha: travel.jamaMaghribIsha,
    };
  }, [settings, location, dismissed]);

  // Auto-reset autoConfirmed when user returns home (distance drops below threshold)
  useEffect(() => {
    const { travel } = settings;
    if (!travel.enabled || !travel.homeBase) return;

    const distance = calculateDistanceKm(
      travel.homeBase.coordinates,
      location.coordinates,
    );

    const prevDistance = prevDistanceRef.current;
    prevDistanceRef.current = distance;

    // If previously above threshold and now below, reset
    if (
      travel.autoConfirmed &&
      prevDistance !== null &&
      prevDistance >= travel.distanceThresholdKm &&
      distance < travel.distanceThresholdKm
    ) {
      updateTravel({ autoConfirmed: false, travelStartDate: null });
      setDismissed(false);
    }
  }, [settings, location, updateTravel]);

  function setHomeBase(home: HomeBaseLocation) {
    updateTravel({ homeBase: home });
  }

  function clearHomeBase() {
    updateTravel({ homeBase: null, travelStartDate: null, autoConfirmed: false });
  }

  function setTravelOverride(override: TravelSettings['override']) {
    const updates: Partial<TravelSettings> = { override };
    // When forcing on, set the travel start date if not already set
    if (override === 'force_on' && !settings.travel.travelStartDate) {
      updates.travelStartDate = new Date().toISOString().split('T')[0];
    }
    updateTravel(updates);
  }

  function toggleJama(pair: 'dhuhrAsr' | 'maghribIsha') {
    if (pair === 'dhuhrAsr') {
      updateTravel({ jamaDhuhrAsr: !settings.travel.jamaDhuhrAsr });
    } else {
      updateTravel({ jamaMaghribIsha: !settings.travel.jamaMaghribIsha });
    }
  }

  function toggleTravelEnabled() {
    const newEnabled = !settings.travel.enabled;
    const updates: Partial<TravelSettings> = { enabled: newEnabled };
    if (newEnabled && !settings.travel.travelStartDate) {
      updates.travelStartDate = new Date().toISOString().split('T')[0];
    }
    updateTravel(updates);
  }

  function confirmTravel() {
    updateTravel({
      autoConfirmed: true,
      travelStartDate: new Date().toISOString().split('T')[0],
    });
    setDismissed(false);
  }

  function dismissTravel() {
    setDismissed(true);
  }

  return (
    <TravelContext.Provider
      value={{
        travelState,
        setHomeBase,
        clearHomeBase,
        setTravelOverride,
        toggleJama,
        toggleTravelEnabled,
        confirmTravel,
        dismissTravel,
      }}
    >
      {children}
    </TravelContext.Provider>
  );
}

export function useTravel() {
  const context = useContext(TravelContext);
  if (!context) {
    throw new Error('useTravel must be used within a TravelProvider');
  }
  return context;
}
