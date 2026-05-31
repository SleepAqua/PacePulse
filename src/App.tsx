import { useEffect, useMemo, useRef, useState } from 'react';
import { openDB } from 'idb';

type Mode = 'HIIT' | 'Muscle Training' | 'Miscellaneous' | 'History';

type MuscleGroup = 'Chest' | 'Back' | 'Leg' | 'Core' | 'Shoulder' | 'Arms' | 'Other';

type AudioClip = { id: number; name: string; url: string };

type WorkoutEntry = {
  id?: number;
  date: string; // YYYY-MM-DD
  mode: 'HIIT' | 'Muscle Training';
  muscleGroup?: MuscleGroup;
  reps?: number[];
  totalReps?: number;
  duration: number; // seconds
  timestamp: number;
};

type AudioDB = {
  'audio-clips': {
    id: number;
    name: string;
    blob: Blob;
  };
  'workout-history': WorkoutEntry;
};

const DB_NAME = 'pacepulse-audio';
const DB_STORE = 'audio-clips';
const HISTORY_STORE = 'workout-history';

const dbPromise = openDB<AudioDB>(DB_NAME, 2, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(DB_STORE)) {
      db.createObjectStore(DB_STORE, { keyPath: 'id', autoIncrement: true });
    }
    if (!db.objectStoreNames.contains(HISTORY_STORE)) {
      const store = db.createObjectStore(HISTORY_STORE, { keyPath: 'id', autoIncrement: true });
      store.createIndex('date', 'date');
    }
  },
});

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const makeBeep = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.value = 0.15;
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.18);
  } catch (error) {
    console.warn('Beep unavailable:', error);
  }
};

const App = () => {
  const [mode, setMode] = useState<Mode>('HIIT');
  const [hiitLoops, setHiitLoops] = useState<number | string>(5);
  const [exerciseMinutes, setExerciseMinutes] = useState<number | string>(0);
  const [exerciseSeconds, setExerciseSeconds] = useState<number | string>(40);
  const [restMinutes, setRestMinutes] = useState<number | string>(0);
  const [restSeconds, setRestSeconds] = useState<number | string>(20);
  const [hiitActivePhase, setHiitActivePhase] = useState<'exercise' | 'rest' | 'idle'>('idle');
  const [hiitSecondsLeft, setHiitSecondsLeft] = useState(40);
  const [hiitCurrentLoop, setHiitCurrentLoop] = useState(1);
  const [hiitRunning, setHiitRunning] = useState(false);
  const [hiitPaused, setHiitPaused] = useState(false);
  const [muscleSets, setMuscleSets] = useState<number | string>(4);
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('Chest');
  const [muscleRestMinutes, setMuscleRestMinutes] = useState<number | string>(2);
  const [muscleRestSeconds, setMuscleRestSeconds] = useState<number | string>(30);
  const [setRepsInput, setSetRepsInput] = useState('');
  const [completedSets, setCompletedSets] = useState<number[]>([]);
  const [muscleSecondsLeft, setMuscleSecondsLeft] = useState(0);
  const [musclePhase, setMusclePhase] = useState<'waiting' | 'resting' | 'done'>('waiting');
  const [musclePaused, setMusclePaused] = useState(false);
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [activeAudioName, setActiveAudioName] = useState<string>('');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rewardAudioRef = useRef<HTMLAudioElement | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioUrls = useRef<string[]>([]);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutEntry[]>([]);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const sessionStartTime = useRef<number>(0);

  const createAudioUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    audioUrls.current.push(url);
    return url;
  };

  const getSeconds = (minutes: number | string, seconds: number | string) =>
    (Number(minutes) || 0) * 60 + (Number(seconds) || 0);

  const hiitComplete = useMemo(
    () => hiitCurrentLoop > (Number(hiitLoops) || 0) && hiitActivePhase === 'idle',
    [hiitCurrentLoop, hiitLoops, hiitActivePhase]
  );

  const muscleComplete = useMemo(
    () => completedSets.length >= (Number(muscleSets) || 0) && musclePhase === 'done',
    [completedSets.length, muscleSets, musclePhase]
  );

  const totalReps = completedSets.reduce((sum, value) => sum + value, 0);

  const playRewardAudio = () => {
    if (rewardAudioRef.current) {
      rewardAudioRef.current.pause();
      rewardAudioRef.current = null;
    }
    setAudioPlaying(false);

    if (!audioClips.length) {
      setActiveAudioName('Beep reward');
      makeBeep();
      return;
    }

    const randomClip = audioClips[Math.floor(Math.random() * audioClips.length)];
    setActiveAudioName(randomClip.name);
    const audio = new Audio(randomClip.url);
    rewardAudioRef.current = audio;
    audio.onended = () => setAudioPlaying(false);
    audio.play().then(() => setAudioPlaying(true)).catch((error) => {
      setAudioPlaying(false);
      console.warn('Reward audio failed to play:', error);
    });
  };

  const pauseRewardAudio = () => {
    if (!rewardAudioRef.current) return;
    rewardAudioRef.current.pause();
    setAudioPlaying(false);
  };

  const resumeRewardAudio = () => {
    if (!rewardAudioRef.current) return;
    rewardAudioRef.current.play().then(() => setAudioPlaying(true)).catch((error) => {
      console.warn('Reward audio resume failed:', error);
    });
  };

  const ensureAudioContext = () => {
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        audioCtxRef.current = null;
      }
    }
    return audioCtxRef.current;
  };

  const resumeAudioContext = async () => {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {
        console.warn('AudioContext resume failed:', e);
      }
    }
  };

  const saveWorkoutEntry = async (entry: Omit<WorkoutEntry, 'id'>) => {
    try {
      const db = await dbPromise;
      await db.add(HISTORY_STORE, entry);
    } catch (error) {
      console.warn('Failed to save workout entry:', error);
    }
  };

  const deleteWorkoutEntry = async (id: number) => {
    if (!window.confirm('Delete this workout entry?')) return;
    try {
      const db = await dbPromise;
      await db.delete(HISTORY_STORE, id);
      setWorkoutHistory((prev) => prev.filter((entry) => entry.id !== id));
    } catch (error) {
      console.warn('Failed to delete workout entry:', error);
    }
  };

  const loadWorkoutHistory = async () => {
    try {
      const db = await dbPromise;
      const entries = await db.getAll(HISTORY_STORE);
      setWorkoutHistory(entries);
    } catch (error) {
      console.warn('Failed to load workout history:', error);
    }
  };

  const getCalendarData = (days: number) => {
    const data: Record<string, { duration: number; types: string[]; dayNum: number }> = {};
    const now = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      data[dateStr] = { duration: 0, types: [], dayNum: d.getDate() };
    }

    workoutHistory.forEach((entry) => {
      if (data[entry.date]) {
        data[entry.date].duration += entry.duration;
        const typeLabel = entry.mode === 'HIIT' ? 'HIIT' : (entry.muscleGroup || 'Muscle');
        if (!data[entry.date].types.includes(typeLabel)) {
          data[entry.date].types.push(typeLabel);
        }
      }
    });

    return Object.entries(data).reverse();
  };

  const getHistoryByDate = (date: string) => {
    return workoutHistory.filter((entry) => entry.date === date);
  };

  const getLastDaysHistory = (days: number) => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return workoutHistory.filter((entry) => entry.timestamp >= cutoff);
  };

  const playBeep = (freq = 880, duration = 0.18) => {
    const ctx = ensureAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = freq;
    gain.gain.value = 0.15;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    oscillator.start(now);
    oscillator.stop(now + duration);
  };

  const speakNumber = (n: number) => {
    playBeep(440 + n * 100, 0.2);
  };

  useEffect(() => {
    if (sessionComplete) {
      playRewardAudio();

      // Save workout to history
      const today = new Date().toISOString().split('T')[0];
      const duration = Math.round((Date.now() - sessionStartTime.current) / 1000);

      if (mode === 'Muscle Training') {
        saveWorkoutEntry({
          date: today,
          mode: 'Muscle Training',
          muscleGroup,
          reps: completedSets,
          totalReps: completedSets.reduce((sum, val) => sum + val, 0),
          duration,
          timestamp: Date.now(),
        });
      } else if (mode === 'HIIT') {
        saveWorkoutEntry({
          date: today,
          mode: 'HIIT',
          duration,
          timestamp: Date.now(),
        });
      }
    }
  }, [sessionComplete, mode, completedSets]);

  useEffect(() => {
    let active = true;

    const loadPersistedAudio = async () => {
      const db = await dbPromise;
      const storedClips = await db.getAll(DB_STORE);
      if (!active) return;
      setAudioClips(
        storedClips.map((clip) => ({
          id: clip.id,
          name: clip.name,
          url: createAudioUrl(clip.blob),
        }))
      );
    };

    loadPersistedAudio();

    return () => {
      active = false;
      audioUrls.current.forEach((url) => URL.revokeObjectURL(url));
      audioUrls.current = [];
    };
  }, []);

  useEffect(() => {
    loadWorkoutHistory();
  }, []);

  useEffect(() => {
    if (!hiitRunning || hiitActivePhase === 'idle' || hiitPaused) return;

    const timer = window.setInterval(() => {
      setHiitSecondsLeft((prev) => {
        if (prev <= 1) {
          makeBeep();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [hiitRunning, hiitActivePhase, hiitPaused]);

  // Play beep countdown when 5 seconds or less remain
  useEffect(() => {
    if (!hiitRunning || hiitActivePhase === 'idle') return;
    if (hiitSecondsLeft <= 5 && hiitSecondsLeft > 0) {
      speakNumber(hiitSecondsLeft);
    }
  }, [hiitSecondsLeft, hiitRunning, hiitActivePhase]);

  useEffect(() => {
    if (!hiitRunning || hiitActivePhase === 'idle' || hiitPaused) return;
    if (hiitSecondsLeft !== 0) return;

    const ex = getSeconds(exerciseMinutes, exerciseSeconds);
    const rt = getSeconds(restMinutes, restSeconds);
    const loopsNum = Number(hiitLoops) || 0;

    if (hiitActivePhase === 'exercise') {
      if (rt > 0) {
        setHiitActivePhase('rest');
        setHiitSecondsLeft(rt);
      } else {
        if (hiitCurrentLoop >= loopsNum) {
          setHiitActivePhase('idle');
          setHiitRunning(false);
          setHiitCurrentLoop((loop) => loop + 1);
          setSessionComplete(true);
        } else {
          setHiitActivePhase('exercise');
          setHiitCurrentLoop((loop) => loop + 1);
          setHiitSecondsLeft(ex);
        }
      }
      return;
    }

    if (hiitActivePhase === 'rest') {
      if (hiitCurrentLoop >= loopsNum) {
        setHiitActivePhase('idle');
        setHiitRunning(false);
        setHiitCurrentLoop((loop) => loop + 1);
        setSessionComplete(true);
      } else {
        setHiitActivePhase('exercise');
        setHiitCurrentLoop((loop) => loop + 1);
        setHiitSecondsLeft(ex);
      }
    }
  }, [hiitSecondsLeft, hiitActivePhase, hiitCurrentLoop, hiitLoops, exerciseMinutes, exerciseSeconds, restMinutes, restSeconds, hiitRunning, hiitPaused]);

  useEffect(() => {
    if (musclePhase !== 'resting' || musclePaused) return;

    const timer = window.setInterval(() => {
      setMuscleSecondsLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [musclePhase, musclePaused]);

  useEffect(() => {
    if (musclePhase === 'resting' && muscleSecondsLeft === 0 && !musclePaused) {
      if (completedSets.length >= (Number(muscleSets) || 0)) {
        setMusclePhase('done');
        setSessionComplete(true);
      } else {
        setMusclePhase('waiting');
      }
    }
  }, [muscleSecondsLeft, completedSets.length, muscleSets, musclePhase, musclePaused]);

  // countdown for muscle rest
  useEffect(() => {
    if (musclePhase !== 'resting') return;
    if (muscleSecondsLeft <= 5 && muscleSecondsLeft > 0) {
      speakNumber(muscleSecondsLeft);
    }
  }, [muscleSecondsLeft, musclePhase]);

  const resetHIIT = () => {
    setHiitActivePhase('idle');
    setHiitSecondsLeft(getSeconds(exerciseMinutes, exerciseSeconds));
    setHiitCurrentLoop(1);
    setHiitRunning(false);
    setHiitPaused(false);
    setSessionComplete(false);
    setActiveAudioName('');
  };

  const resetMuscle = () => {
    setCompletedSets([]);
    setSetRepsInput('');
    setMuscleSecondsLeft(0);
    setMusclePhase('waiting');
    setMusclePaused(false);
    setSessionComplete(false);
    setActiveAudioName('');
  };

  const startHIIT = () => {
    const ex = getSeconds(exerciseMinutes, exerciseSeconds);
    const loopsNum = Number(hiitLoops) || 0;
    if (loopsNum < 1 || ex < 1) return;
    resumeAudioContext();
    sessionStartTime.current = Date.now();
    setSessionComplete(false);
    setHiitCurrentLoop(1);
    setHiitActivePhase('exercise');
    setHiitSecondsLeft(ex);
    setHiitRunning(true);
    setHiitPaused(false);
    setActiveAudioName('');
  };

  const toggleHIITPause = () => {
    if (!hiitRunning) return;
    const newPausedState = !hiitPaused;
    setHiitPaused(newPausedState);
  };

  const toggleMusclePause = () => {
    if (musclePhase !== 'resting') return;
    const newPausedState = !musclePaused;
    setMusclePaused(newPausedState);
  };

  const addReps = () => {
    const reps = Number(setRepsInput);
    if (!Number.isFinite(reps) || reps <= 0) return;
    resumeAudioContext();
    const nextSets = [...completedSets, reps];
    if (nextSets.length === 1) {
      // First set recorded, start tracking session time
      sessionStartTime.current = Date.now();
    }
    setCompletedSets(nextSets);
    setSetRepsInput('');
    if (nextSets.length >= (Number(muscleSets) || 0)) {
      setMusclePhase('done');
      setSessionComplete(true);
      setMuscleSecondsLeft(0);
      setMusclePaused(false);
      return;
    }
    setMusclePhase('resting');
    setMusclePaused(false);
    setMuscleSecondsLeft(getSeconds(muscleRestMinutes, muscleRestSeconds));
  };

  const handleAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    const db = await dbPromise;
    const newClips: AudioClip[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('audio')) continue;
      const id = await db.add(DB_STORE, { name: file.name, blob: file });
      const url = createAudioUrl(file);
      newClips.push({ id: Number(id), name: file.name, url });
    }
    setAudioClips((existing) => [...existing, ...newClips]);
    event.target.value = '';
  };

  const removeClip = async (index: number) => {
    const clip = audioClips[index];
    if (!clip) return;
    const db = await dbPromise;
    await db.delete(DB_STORE, clip.id);
    URL.revokeObjectURL(clip.url);
    audioUrls.current = audioUrls.current.filter((url) => url !== clip.url);
    setAudioClips((existing) => existing.filter((_, i) => i !== index));
  };

  return (
    <div className="app-shell">
      <header>
        <h1>PacePulse Timer</h1>
        <p>HIIT & Muscle Training timer with reward audio for session completion.</p>
      </header>

      <section className="mode-switcher">
        {(['HIIT', 'Muscle Training', 'Miscellaneous', 'History'] as Mode[]).map((option) => (
          <button
            key={option}
            className={mode === option ? 'active' : ''}
            onClick={() => {
              setMode(option);
              setSessionComplete(false);
              setActiveAudioName('');
            }}
          >
            {option}
          </button>
        ))}
      </section>

      <main>
        <section className="panel">
          <div className="panel-header">
            <h2>
              {mode === 'HIIT' ? 'HIIT Timer' : mode === 'Miscellaneous' ? 'Miscellaneous Timer' : mode === 'Muscle Training' ? 'Muscle Training Timer' : 'Workout History'}
            </h2>
          </div>

          {mode === 'History' ? (
            <div className="panel-body history-panel">
              <div className="calendar-section">
                <h3>Last 30 Days</h3>
                <div className="calendar-grid">
                  {getCalendarData(30).map(([date, info]) => (
                    <div
                      key={date}
                      className={`calendar-day ${info.duration > 0 ? 'has-data' : ''}`}
                      title={date}
                    >
                      <span className="day-num">{info.dayNum}</span>
                      {info.duration > 0 && (
                        <div className="day-info">
                          <span className="day-types">{info.types.join(',')}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="calendar-header">
                <h3>Select a date to view workouts</h3>
              </div>
              <input
                type="date"
                value={selectedHistoryDate}
                onChange={(event) => setSelectedHistoryDate(event.target.value)}
                className="date-picker"
              />
              {getHistoryByDate(selectedHistoryDate).length === 0 ? (
                <p className="no-data">No workouts on this date</p>
              ) : (
                <div className="history-list">
                  {getHistoryByDate(selectedHistoryDate).map((entry, idx) => (
                    <div key={idx} className="history-item">
                      <div className="history-mode">
                        {entry.mode === 'HIIT' ? 'HIIT' : (entry.muscleGroup || 'Muscle Training')}
                      </div>
                      <div className="history-details">
                        {entry.mode === 'Muscle Training' && entry.reps && (
                          <>
                            <p>Sets: {entry.reps.length} | Reps: {entry.reps.join(', ')}</p>
                            <p>Total reps: {entry.totalReps}</p>
                          </>
                        )}
                        <p>Duration: {formatTime(entry.duration)}</p>
                      </div>
                      <button
                        className="delete-btn"
                        onClick={() => entry.id && deleteWorkoutEntry(entry.id)}
                        title="Delete entry"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="history-stats">
                <h3>Last 30 days</h3>
                <div className="stats-grid">
                  <div className="stat-card">
                    <p className="stat-label">Total workouts</p>
                    <p className="stat-value">{getLastDaysHistory(30).length}</p>
                  </div>
                  <div className="stat-card">
                    <p className="stat-label">Total time</p>
                    <p className="stat-value">{formatTime(getLastDaysHistory(30).reduce((sum, e) => sum + e.duration, 0))}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (mode === 'HIIT' || mode === 'Miscellaneous') ? (
            <div className="panel-body">
              <div className="field-row">
                <label>
                  Loops
                  <input
                    type="number"
                    min={1}
                    value={hiitLoops}
                    onChange={(event) => setHiitLoops(event.target.value)}
                  />
                </label>
                <label>
                  Exercise
                  <div className="inline-inputs-container">
                    <div className="inline-inputs">
                      <div className="input-with-label">
                        <input
                          type="number"
                          min={0}
                          value={exerciseMinutes}
                          onChange={(event) => setExerciseMinutes(event.target.value)}
                        />
                        <span className="unit-label">min</span>
                      </div>
                      <span className="separator">:</span>
                      <div className="input-with-label">
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={exerciseSeconds}
                          onChange={(event) => setExerciseSeconds(event.target.value)}
                        />
                        <span className="unit-label">sec</span>
                      </div>
                    </div>
                  </div>
                </label>
                <label>
                  Rest
                  <div className="inline-inputs-container">
                    <div className="inline-inputs">
                      <div className="input-with-label">
                        <input
                          type="number"
                          min={0}
                          value={restMinutes}
                          onChange={(event) => setRestMinutes(event.target.value)}
                        />
                        <span className="unit-label">min</span>
                      </div>
                      <span className="separator">:</span>
                      <div className="input-with-label">
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={restSeconds}
                          onChange={(event) => setRestSeconds(event.target.value)}
                        />
                        <span className="unit-label">sec</span>
                      </div>
                    </div>
                  </div>
                </label>
              </div>

              <div className="status-card">
                <p>Loop {Math.min(hiitCurrentLoop, Number(hiitLoops) || 0)} / {Number(hiitLoops) || 0}</p>
                <p>Phase: {hiitActivePhase === 'idle' ? 'Idle' : hiitActivePhase}</p>
                <p className="timer-display">{formatTime(hiitSecondsLeft)}</p>
              </div>

              <div className="control-row">
                <button onClick={startHIIT} disabled={hiitRunning || hiitComplete}>
                  Start HIIT
                </button>
                <button
                  className="pause-button"
                  type="button"
                  onClick={toggleHIITPause}
                  disabled={!hiitRunning || hiitComplete}
                >
                  {hiitPaused ? '▶️ Resume' : '⏸ Pause'}
                </button>
                <button onClick={resetHIIT}>Reset</button>
              </div>
            </div>
          ) : (
            <div className="panel-body">
              <div className="field-row">
                <label>
                  Muscle Group
                  <select
                    value={muscleGroup}
                    onChange={(event) => setMuscleGroup(event.target.value as MuscleGroup)}
                  >
                    {['Chest', 'Back', 'Leg', 'Core', 'Shoulder', 'Arms'].map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Sets
                  <input
                    type="number"
                    min={1}
                    value={muscleSets}
                    onChange={(event) => setMuscleSets(event.target.value)}
                  />
                </label>
                <label>
                  Rest
                  <div className="inline-inputs-container">
                    <div className="inline-inputs">
                      <div className="input-with-label">
                        <input
                          type="number"
                          min={0}
                          value={muscleRestMinutes}
                          onChange={(event) => setMuscleRestMinutes(event.target.value)}
                        />
                        <span className="unit-label">min</span>
                      </div>
                      <span className="separator">:</span>
                      <div className="input-with-label">
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={muscleRestSeconds}
                          onChange={(event) => setMuscleRestSeconds(event.target.value)}
                        />
                        <span className="unit-label">sec</span>
                      </div>
                    </div>
                  </div>
                </label>
              </div>

              <div className="status-card">
                <p>Completed sets: {completedSets.length} / {muscleSets}</p>
                <p>Phase: {musclePhase === 'waiting' ? 'Input reps' : musclePhase === 'resting' ? 'Resting' : 'Done'}</p>
                {musclePhase === 'resting' ? <p className="timer-display">{formatTime(muscleSecondsLeft)}</p> : null}
                <p>Total reps: {totalReps}</p>
              </div>
              <div className="field-row vertical">
                <label>
                  Reps for set {completedSets.length + 1}
                  <input
                    type="number"
                    min={1}
                    value={setRepsInput}
                    onChange={(event) => setSetRepsInput(event.target.value)}
                    disabled={musclePhase === 'resting' || musclePhase === 'done'}
                  />
                </label>
                <button onClick={addReps} disabled={!setRepsInput || musclePhase !== 'waiting'}>
                  Record Reps
                </button>
              </div>

              <div className="control-row">
                <button
                  className="pause-button"
                  type="button"
                  onClick={toggleMusclePause}
                  disabled={musclePhase !== 'resting'}
                >
                  {musclePaused ? '▶️ Resume' : '⏸ Pause'}
                </button>
                <button onClick={resetMuscle}>Reset</button>
              </div>

              <div className="history-card">
                <h3>Set history</h3>
                {completedSets.length === 0 ? (
                  <p>No sets logged yet.</p>
                ) : (
                  <ul>
                    {completedSets.map((value, index) => (
                      <li key={index}>Set {index + 1}: {value} reps</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="panel audio-panel">
          <div className="panel-header">
            <h2>Audio Reward</h2>
          </div>
          <div className="panel-body">
            <label className="file-upload">
              Upload audio files or folders
              <input type="file" accept="audio/*" multiple onChange={handleAudioUpload} {...({ webkitdirectory: true, directory: true } as any)} />
            </label>
            <div className="field-row audio-control-row">
              <button type="button" onClick={playRewardAudio} disabled={audioPlaying}>
                Play reward now
              </button>
              <button type="button" onClick={pauseRewardAudio} disabled={!audioPlaying}>
                Pause reward
              </button>
              <button type="button" onClick={resumeRewardAudio} disabled={audioPlaying || !rewardAudioRef.current}>
                Resume reward
              </button>
            </div>
            <p>Uploaded clips: {audioClips.length}</p>
            {audioClips.length > 0 && (
              <ul className="audio-list">
                {audioClips.map((clip, index) => (
                  <li key={`${clip.name}-${index}`}>
                    <span>{clip.name}</span>
                    <button type="button" onClick={() => removeClip(index)}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
            {sessionComplete && (
              <div className="complete-banner">
                <strong>Session complete!</strong>
                <p>{activeAudioName ? `Rewarding with: ${activeAudioName}` : 'Playing beep reward.'}</p>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;
