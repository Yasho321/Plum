/**
 * OWNER    : Tanmay
 * DUE      : D1 20:00
 * TASK     :
 *   0–72 h slider with play/pause, IST labels, drives timeStore.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { useEffect, useRef } from 'react';
import { useTimeStore } from '../../stores/timeStore';
import { formatIst } from '../../lib/format';
import { Play, Pause } from 'lucide-react';

export default function TimeSlider() {
  const { leadH, setLeadH, playing, setPlaying, speed, getValidHour } = useTimeStore();
  const validHour = getValidHour();
  const validHourIst = validHour ? formatIst(validHour) : '';
  const timerRef = useRef(null);

  useEffect(() => {
    if (playing) {
      timerRef.current = setInterval(() => {
        setLeadH((prev) => (prev >= 72 ? 0 : prev + speed));
      }, 500);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, speed, setLeadH]);

  return (
    <div className="bg-card border border-border p-4 rounded-lg shadow-sm flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">Forecast Time</span>
        <span className="text-sm text-muted-foreground">{validHourIst || `+${leadH}h`}</span>
      </div>
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setPlaying(!playing)}
          className="p-2 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition"
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <input 
          type="range" 
          min="0" 
          max="72" 
          step="1"
          value={leadH} 
          onChange={(e) => setLeadH(parseInt(e.target.value))}
          className="w-full flex-1 cursor-pointer"
        />
      </div>
    </div>
  );
}
