import { useState, useEffect } from 'react';
import type { PrayerName, TravelState, DisplaySettings } from '../types';

interface CountdownTimerProps {
  currentPrayer: PrayerName | null;
  currentPrayerTime: Date | null;
  nextPrayer: string | null;
  nextPrayerTime: Date | null;
  hours: number;
  minutes: number;
  seconds: number;
  isTraveling?: boolean;
  travelState?: TravelState;
  display: DisplaySettings;
}

// Sunnah prayers associated with each fard prayer
const SUNNAH_PRAYERS: Record<PrayerName, { before?: string; after?: string; notes?: string }> = {
  fajr: { before: '2 rak\'at Sunnah' },
  sunrise: {},
  dhuhr: { before: '4 rak\'at Sunnah', after: '2 rak\'at Sunnah' },
  asr: { before: '4 rak\'at (optional)' },
  maghrib: { after: '2 rak\'at Sunnah' },
  isha: { after: '2 rak\'at Sunnah + Witr', notes: 'Tahajjud available until Fajr' },
};

// When traveling, drop most rawatib — keep Fajr sunnah + Witr
const SUNNAH_PRAYERS_TRAVEL: Record<PrayerName, { before?: string; after?: string; notes?: string }> = {
  fajr: { before: '2 rak\'at Sunnah' },
  sunrise: {},
  dhuhr: {},
  asr: {},
  maghrib: {},
  isha: { after: 'Witr' },
};

export function CountdownTimer({ currentPrayer, currentPrayerTime, nextPrayer, nextPrayerTime, hours, minutes, seconds, isTraveling = false, travelState, display }: CountdownTimerProps) {
  const formatNumber = (n: number) => n.toString().padStart(2, '0');

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const currentLabel = currentPrayer ? capitalize(currentPrayer) : null;

  // Compute next prayer label for Jama' travel mode
  let nextLabel = nextPrayer ? capitalize(nextPrayer) : null;
  if (travelState?.isTraveling && nextPrayer) {
    if (nextPrayer === 'dhuhr' && travelState.jamaDhuhrAsr) {
      nextLabel = 'Dhuhr + Asr';
    }
    if (nextPrayer === 'maghrib' && travelState.jamaMaghribIsha) {
      nextLabel = 'Maghrib + Isha';
    }
  }

  // Elapsed time since current prayer started + progress through prayer window
  const [elapsed, setElapsed] = useState({ h: 0, m: 0, s: 0 });
  const [progress, setProgress] = useState(0); // 0 to 1 representing how far through the prayer window
  useEffect(() => {
    if (!currentPrayer || !currentPrayerTime || !display.showCurrentPrayer) return;

    const update = () => {
      const now = new Date();
      const diff = Math.max(0, Math.floor((now.getTime() - currentPrayerTime.getTime()) / 1000));
      setElapsed({
        h: Math.floor(diff / 3600),
        m: Math.floor((diff % 3600) / 60),
        s: diff % 60,
      });

      // Compute progress through prayer window (0 at start, 1 at end)
      if (nextPrayerTime) {
        const totalDuration = nextPrayerTime.getTime() - currentPrayerTime.getTime();
        const elapsedDuration = now.getTime() - currentPrayerTime.getTime();
        setProgress(totalDuration > 0 ? Math.min(1, Math.max(0, elapsedDuration / totalDuration)) : 0);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [currentPrayer, currentPrayerTime, nextPrayerTime, display.showCurrentPrayer]);

  // Red urgency only kicks in past 60% of the prayer window
  const isUrgent = progress >= 0.6;
  // Border width scales from 1px to 2px only during urgent phase
  const borderWidth = isUrgent ? 1 + ((progress - 0.6) / 0.4) : 1;

  const sunnahSource = isTraveling ? SUNNAH_PRAYERS_TRAVEL : SUNNAH_PRAYERS;
  const sunnahInfo = currentPrayer ? sunnahSource[currentPrayer] : null;

  // Build list of prayable prayers
  const prayablePrayers: { name: string; type: 'fard' | 'sunnah' | 'nafl'; detail?: string }[] = [];

  if (currentPrayer && currentPrayer !== 'sunrise') {
    // Add sunnah before
    if (sunnahInfo?.before) {
      prayablePrayers.push({ name: `${currentLabel} Sunnah`, type: 'sunnah', detail: sunnahInfo.before });
    }
    // Add sunnah after
    if (sunnahInfo?.after) {
      prayablePrayers.push({ name: `${currentLabel} Sunnah`, type: 'sunnah', detail: sunnahInfo.after });
    }
  }

  // During sunrise, only Duha/Ishraq is available (after sun rises ~15min)
  if (currentPrayer === 'sunrise') {
    prayablePrayers.push({ name: 'Ishraq/Duha', type: 'nafl', detail: '2-8 rak\'at (after sunrise)' });
  }

  const naflPrayer = prayablePrayers.find(p => p.type === 'nafl');
  const regularPrayers = prayablePrayers.filter(p => p.type !== 'nafl');

  return (
    <div className="space-y-3">
      {/* Current Prayer Card */}
      {display.showCurrentPrayer && currentPrayer && currentPrayer !== 'sunrise' && (
        <div
          className={`bg-[var(--color-card)] rounded-lg p-3 border relative z-[45] ${
            isUrgent ? 'border-red-500/50 current-prayer-glow' : 'border-[var(--color-border)]'
          }`}
          style={isUrgent ? { borderWidth: `${borderWidth}px` } : undefined}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide mb-0.5">
                Current Prayer
              </p>
              <p className="text-lg font-semibold text-[var(--color-text)]">
                {currentLabel}
              </p>
            </div>
            {currentPrayerTime ? (
              <div className="flex items-baseline gap-0.5">
                <span className="text-2xl font-bold text-[var(--color-text)] tabular-nums">
                  {formatNumber(elapsed.h)}
                </span>
                <span className="text-lg text-[var(--color-muted)]">:</span>
                <span className="text-2xl font-bold text-[var(--color-text)] tabular-nums">
                  {formatNumber(elapsed.m)}
                </span>
                <span className="text-lg text-[var(--color-muted)]">:</span>
                <span className="text-2xl font-bold text-[var(--color-muted)] tabular-nums">
                  {formatNumber(elapsed.s)}
                </span>
                <span className="text-xs text-[var(--color-muted)] ml-1 self-center">ago</span>
              </div>
            ) : (
              <span className="text-sm font-medium text-[var(--color-primary)]">Active</span>
            )}
          </div>
        </div>
      )}

      {/* Sunnah Prayers Card */}
      {display.showSunnahCard && regularPrayers.length > 0 && (
        <div className="bg-[var(--color-card)] rounded-lg p-3 border border-[var(--color-border)]">
          <div className="space-y-1.5">
            {regularPrayers.map((prayer, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className={`text-sm ${
                  prayer.type === 'fard' ? 'font-semibold text-[var(--color-text)]' : 'text-[var(--color-muted)]'
                }`}>
                  {prayer.name}
                </span>
                {prayer.detail && (
                  <span className="text-xs text-[var(--color-muted)]">{prayer.detail}</span>
                )}
              </div>
            ))}
          </div>
          {sunnahInfo?.notes && (
            <p className="text-xs text-[var(--color-muted)] mt-2 italic">{sunnahInfo.notes}</p>
          )}
        </div>
      )}

      {/* Next Prayer Countdown Card */}
      {display.showNextPrayer && nextPrayer && (
        <div className="bg-[var(--color-card)] rounded-lg p-3 border border-[var(--color-border)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide mb-0.5">
                Next Prayer
              </p>
              <p className="text-lg font-semibold text-[var(--color-text)]">
                {nextLabel}
              </p>
            </div>
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl font-bold text-[var(--color-text)] tabular-nums">
                {formatNumber(hours)}
              </span>
              <span className="text-lg text-[var(--color-muted)]">:</span>
              <span className="text-2xl font-bold text-[var(--color-text)] tabular-nums">
                {formatNumber(minutes)}
              </span>
              <span className="text-lg text-[var(--color-muted)]">:</span>
              <span className="text-2xl font-bold text-[var(--color-primary)] tabular-nums">
                {formatNumber(seconds)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Ishraq/Duha Card */}
      {display.showSunnahCard && naflPrayer && (
        <div className="bg-[var(--color-card)] rounded-lg p-3 border border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide mb-2">
            Optional Prayer
          </p>
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-[var(--color-text)]">
              {naflPrayer.name}
            </p>
            <p className="text-sm text-[var(--color-muted)]">
              {naflPrayer.detail}
            </p>
          </div>
        </div>
      )}

      {/* If no next prayer and no prayable prayers, show current time label */}
      {!nextPrayer && prayablePrayers.length === 0 && currentPrayer && (
        <div className="bg-[var(--color-card)] rounded-lg p-3 border border-[var(--color-border)] text-center">
          <p className="text-sm text-[var(--color-muted)]">
            {currentLabel} time
          </p>
        </div>
      )}

      <style>{`
        @keyframes prayer-glow {
          0%, 100% { box-shadow: 0 0 8px rgba(239, 68, 68, 0.15), 0 0 20px rgba(239, 68, 68, 0.08); }
          50% { box-shadow: 0 0 14px rgba(239, 68, 68, 0.3), 0 0 32px rgba(239, 68, 68, 0.12); }
        }
        .current-prayer-glow {
          animation: prayer-glow 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
