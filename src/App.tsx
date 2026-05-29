import { useEffect, useMemo, useRef, useState } from 'react';
import { openDB } from 'idb';

type Mode = 'HIIT' | 'Muscle Training';

type AudioClip = { id: number; name: string; url: string };

type AudioDB = {
  'audio-clips': {
    id: number;
    name: string;
    blob: Blob;
  };
};

const DB_NAME = 'pacepulse-audio';
const DB_STORE = 'audio-clips';
const dbPromise = openDB<AudioDB>(DB_NAME, 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(DB_STORE)) {
      db.createObjectStore(DB_STORE, { keyPath: 'id', autoIncrement: true });
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
  const [exerciseTime, setExerciseTime] = useState<number | string>(40);
  const [restTime, setRestTime] = useState<number | string>(20);
  const [hiitActivePhase, setHiitActivePhase] = useState<'exercise' | 'rest' | 'idle'>('idle');
  const [hiitSecondsLeft, setHiitSecondsLeft] = useState(40);
  const [hiitCurrentLoop, setHiitCurrentLoop] = useState(1);
  const [hiitRunning, setHiitRunning] = useState(false);
  const [muscleSets, setMuscleSets] = useState<number | string>(4);
  const [muscleRestTime, setMuscleRestTime] = useState<number | string>(60);
  const [setRepsInput, setSetRepsInput] = useState('');
  const [completedSets, setCompletedSets] = useState<number[]>([]);
  const [muscleSecondsLeft, setMuscleSecondsLeft] = useState(0);
  const [musclePhase, setMusclePhase] = useState<'waiting' | 'resting' | 'done'>('waiting');
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [activeAudioName, setActiveAudioName] = useState<string>('');
  const [countdownSound, setCountdownSound] = useState<'female' | 'male' | 'beep'>('female');
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioUrls = useRef<string[]>([]);

  const createAudioUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    audioUrls.current.push(url);
    return url;
  };

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
    if (!audioClips.length) {
      makeBeep();
      return;
    }

    const randomClip = audioClips[Math.floor(Math.random() * audioClips.length)];
    setActiveAudioName(randomClip.name);
    const audio = new Audio(randomClip.url);
    audio.play().catch((error) => console.warn('Reward audio failed to play:', error));
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
    const freqMap: Record<number, number> = { 5: 900, 4: 800, 3: 700, 2: 600, 1: 500 };
    const pitchFreq = freqMap[n] || 880;

    if (countdownSound === 'beep') {
      playBeep(pitchFreq, 0.2);
      return;
    }

    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(String(n));
        utter.lang = 'en-US';
        utter.rate = 1;
        utter.pitch = countdownSound === 'female' ? 1.5 : 0.8;
        utter.volume = 1;
        window.speechSynthesis.speak(utter);
      } catch (e) {
        console.warn('Speech synthesis failed, falling back to beep:', e);
      }
    }

    // Also play a short beep so countdown is audible even if voice fails.
    playBeep(pitchFreq, 0.18);
  };

  useEffect(() => {
    if (sessionComplete) {
      playRewardAudio();
    }
  }, [sessionComplete]);

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
    if (!hiitRunning || hiitActivePhase === 'idle') return;

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
  }, [hiitRunning, hiitActivePhase, exerciseTime, restTime]);

  // Play spoken or beep countdown when 5 seconds or less remain
  useEffect(() => {
    if (!hiitRunning || hiitActivePhase === 'idle') return;
    if (hiitSecondsLeft <= 5 && hiitSecondsLeft > 0) {
      speakNumber(hiitSecondsLeft);
    }
  }, [hiitSecondsLeft, hiitRunning, hiitActivePhase, countdownSound]);

  useEffect(() => {
    if (!hiitRunning || hiitActivePhase === 'idle') return;
    if (hiitSecondsLeft !== 0) return;

    const ex = Number(exerciseTime) || 0;
    const rt = Number(restTime) || 0;
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
  }, [hiitSecondsLeft, hiitActivePhase, hiitCurrentLoop, hiitLoops, exerciseTime, restTime, hiitRunning]);

  useEffect(() => {
    if (musclePhase !== 'resting') return;

    const timer = window.setInterval(() => {
      setMuscleSecondsLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [musclePhase]);

  useEffect(() => {
    if (musclePhase === 'resting' && muscleSecondsLeft === 0) {
      if (completedSets.length >= (Number(muscleSets) || 0)) {
        setMusclePhase('done');
        setSessionComplete(true);
      } else {
        setMusclePhase('waiting');
      }
    }
  }, [muscleSecondsLeft, completedSets.length, muscleSets, musclePhase]);

  // countdown audio for muscle rest
  useEffect(() => {
    if (musclePhase !== 'resting') return;
    if (muscleSecondsLeft <= 5 && muscleSecondsLeft > 0) {
      speakNumber(muscleSecondsLeft);
    }
  }, [muscleSecondsLeft, musclePhase, countdownSound]);

  const resetHIIT = () => {
    setHiitActivePhase('idle');
    setHiitSecondsLeft(Number(exerciseTime) || 0);
    setHiitCurrentLoop(1);
    setHiitRunning(false);
    setSessionComplete(false);
    setActiveAudioName('');
  };

  const resetMuscle = () => {
    setCompletedSets([]);
    setSetRepsInput('');
    setMuscleSecondsLeft(0);
    setMusclePhase('waiting');
    setSessionComplete(false);
    setActiveAudioName('');
  };

  const startHIIT = () => {
    const ex = Number(exerciseTime) || 0;
    const loopsNum = Number(hiitLoops) || 0;
    if (loopsNum < 1 || ex < 1) return;
    resumeAudioContext();
    setSessionComplete(false);
    setHiitCurrentLoop(1);
    setHiitActivePhase('exercise');
    setHiitSecondsLeft(ex);
    setHiitRunning(true);
    setActiveAudioName('');
  };

  const addReps = () => {
    const reps = Number(setRepsInput);
    if (!Number.isFinite(reps) || reps <= 0) return;
    resumeAudioContext();
    const nextSets = [...completedSets, reps];
    setCompletedSets(nextSets);
    setSetRepsInput('');
    if (nextSets.length >= (Number(muscleSets) || 0)) {
      setMusclePhase('done');
      setSessionComplete(true);
      setMuscleSecondsLeft(0);
      return;
    }
    setMusclePhase('resting');
    setMuscleSecondsLeft(Number(muscleRestTime) || 0);
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
        <h1>PacePulse Workout Timer</h1>
        <p>HIIT & Muscle Training timer with reward audio for session completion.</p>
      </header>

      <section className="mode-switcher">
        {(['HIIT', 'Muscle Training'] as Mode[]).map((option) => (
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
            <h2>{mode === 'HIIT' ? 'HIIT Timer' : 'Muscle Training Timer'}</h2>
          </div>

          {mode === 'HIIT' ? (
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
                  Exercise (sec)
                  <input
                    type="number"
                    min={5}
                    value={exerciseTime}
                    onChange={(event) => setExerciseTime(event.target.value)}
                  />
                </label>
                <label>
                  Rest (sec)
                  <input
                    type="number"
                    min={0}
                    value={restTime}
                    onChange={(event) => setRestTime(event.target.value)}
                  />
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
                <button onClick={resetHIIT}>Reset</button>
              </div>
            </div>
          ) : (
            <div className="panel-body">
              <div className="field-row">
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
                  Rest (sec)
                  <input
                    type="number"
                    min={10}
                    value={muscleRestTime}
                    onChange={(event) => setMuscleRestTime(event.target.value)}
                  />
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

              <div className="control-row">
                <button onClick={resetMuscle}>Reset</button>
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
              Upload audio files
              <input type="file" accept="audio/*" multiple onChange={handleAudioUpload} />
            </label>
            <p className="audio-hint">Pick the countdown sound before starting the timer.</p>
            <div className="field-row">
              <label>
                Countdown sound
                <select value={countdownSound} onChange={(e) => setCountdownSound(e.target.value as any)}>
                  <option value="female">Voice (female)</option>
                  <option value="male">Voice (male)</option>
                  <option value="beep">Beeps (fallback)</option>
                </select>
              </label>
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
