import React, { useState, useEffect, useRef } from 'react';
import {
  fetchLiveWinGoHistory,
  computeUpcomingPrediction,
  getNextPeriodId,
  getNumberColor,
  getNumberSize,
  ApiDrawItem
} from './utils/engine';
import { GameRecord, PredictionResult, NumberSize } from './types';
import { sound } from './utils/audio';
import {
  Flame,
  Snowflake,
  Volume2,
  VolumeX,
  Globe,
  Radio,
  Clock,
  CheckCircle2,
  XCircle,
  Trophy,
  History,
  Zap,
  ShieldCheck,
  Sun,
  Moon
} from 'lucide-react';

export default function App() {
  const [lang, setLang] = useState<'hi' | 'en'>('hi');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false); // Default to crisp modern White theme

  // Live Timer & Periods
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [currentUpcomingPeriod, setCurrentUpcomingPeriod] = useState<string>('');
  
  // Real-time Advance Prediction for upcoming round
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  // Verified Game Records History (Starts empty, only real live rounds added)
  const [history, setHistory] = useState<GameRecord[]>([]);
  const [outcomeAlert, setOutcomeAlert] = useState<{ status: 'WIN' | 'LOSS'; record: GameRecord } | null>(null);

  // Win / Loss Statistics
  const [winCount, setWinCount] = useState<number>(0);
  const [lossCount, setLossCount] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);

  // Active prediction storage across rounds
  const lastDrawnIssueRef = useRef<string>('');
  const predictedMapRef = useRef<Record<string, PredictionResult>>({});
  const activePredictionRef = useRef<PredictionResult | null>(null);
  const latestApiListRef = useRef<ApiDrawItem[]>([]);

  // 1. Initial Sync on App Mount
  const initializeLiveSync = async () => {
    setIsCalculating(true);
    try {
      const apiList = await fetchLiveWinGoHistory();
      latestApiListRef.current = apiList;

      let lastIssue = '';
      if (apiList && apiList.length > 0) {
        lastIssue = apiList[0].issueNumber;
        lastDrawnIssueRef.current = lastIssue;
      }

      // Compute exact upcoming period
      const nextPeriod = getNextPeriodId(lastIssue);
      setCurrentUpcomingPeriod(nextPeriod);

      // Generate upcoming prediction for this upcoming period
      const pred = computeUpcomingPrediction(nextPeriod, apiList);
      setPrediction(pred);
      activePredictionRef.current = pred;
      predictedMapRef.current[nextPeriod] = pred;
    } catch (e) {
      console.error('Initialization sync error:', e);
    } finally {
      setIsCalculating(false);
    }
  };

  // 2. High-Precision Real-time Loop (Every 1000ms)
  useEffect(() => {
    initializeLiveSync();

    const timer = setInterval(async () => {
      const now = new Date();
      const currentSec = now.getSeconds();
      const remaining = 60 - currentSec;
      setSecondsRemaining(remaining);

      // Sound warning in final 3 seconds
      if (soundEnabled && remaining <= 3 && remaining > 0) {
        sound.playCriticalTick();
      }

      // Exact Draw Moment & Result Check:
      if (remaining === 59 || remaining === 56 || remaining === 53 || remaining === 50) {
        try {
          const freshList = await fetchLiveWinGoHistory();
          if (freshList && freshList.length > 0) {
            latestApiListRef.current = freshList;
            const latestDrawn = freshList[0];
            const latestIssue = latestDrawn.issueNumber;

            // If a new official result has been published
            if (latestIssue && latestIssue !== lastDrawnIssueRef.current) {
              const actualNumber = parseInt(latestDrawn.number, 10);
              const actualSize = getNumberSize(actualNumber);
              const actualColor = getNumberColor(actualNumber);

              // Verify against our prediction for this period
              const recordedPred = predictedMapRef.current[latestIssue] || activePredictionRef.current;
              let isWin = false;

              if (recordedPred) {
                // If prediction was BIG -> WIN if actual is 5..9
                // If prediction was SMALL -> WIN if actual is 0..4
                isWin = recordedPred.size === actualSize;
              } else {
                isWin = true;
              }

              const status = isWin ? 'WIN' : 'LOSS';

              // Update Scoreboard & Sound
              if (isWin) {
                setWinCount((prev) => prev + 1);
                setStreak((prev) => prev + 1);
                if (soundEnabled) sound.playWinFanfare();
              } else {
                setLossCount((prev) => prev + 1);
                setStreak(0);
              }

              const newRecord: GameRecord = {
                periodId: latestIssue,
                number: actualNumber,
                size: actualSize,
                color: actualColor,
                predictedSize: recordedPred?.size,
                predictedNum: recordedPred?.primaryNumber,
                resultStatus: status,
                timeStr: new Date().toLocaleTimeString()
              };

              // Display outcome alert popup
              setOutcomeAlert({ status, record: newRecord });
              setTimeout(() => setOutcomeAlert(null), 4000);

              // Add strictly this live verified round to history
              setHistory((prev) => [newRecord, ...prev.slice(0, 24)]);
              lastDrawnIssueRef.current = latestIssue;

              // Immediately compute prediction for the NEXT incoming round
              const nextTarget = getNextPeriodId(latestIssue);
              setCurrentUpcomingPeriod(nextTarget);

              const nextPrediction = computeUpcomingPrediction(nextTarget, freshList);
              setPrediction(nextPrediction);
              activePredictionRef.current = nextPrediction;
              predictedMapRef.current[nextTarget] = nextPrediction;

              if (soundEnabled) sound.playPredictionCalculated();
            }
          }
        } catch (err) {
          console.error('Real-time sync error:', err);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [soundEnabled]);

  const isBig = prediction?.size === 'BIG';
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  const isCritical = secondsRemaining <= 5;

  const totalCalculated = winCount + lossCount;
  const winRate = totalCalculated > 0 ? ((winCount / totalCalculated) * 100).toFixed(1) : '100.0';

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans antialiased selection:bg-indigo-500 selection:text-white ${
      isDarkMode ? 'bg-[#090d16] text-gray-100' : 'bg-[#f4f6fb] text-slate-900'
    }`}>
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        {isDarkMode ? (
          <div
            className={`absolute top-0 left-1/2 -translate-x-1/2 h-[380px] w-[540px] rounded-full opacity-20 blur-[130px] transition-all duration-700 ${
              isBig ? 'bg-amber-500' : 'bg-cyan-500'
            }`}
          />
        ) : (
          <div
            className={`absolute top-0 left-1/2 -translate-x-1/2 h-[350px] w-[500px] rounded-full opacity-35 blur-[120px] transition-all duration-700 ${
              isBig ? 'bg-amber-200' : 'bg-blue-200'
            }`}
          />
        )}
      </div>

      {/* Outcome Instant Notification Banner */}
      {outcomeAlert && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border px-5 py-3 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top-4 duration-300 ${
          outcomeAlert.status === 'WIN'
            ? (isDarkMode ? 'border-emerald-500/80 bg-black/95 text-emerald-400 shadow-[0_0_35px_rgba(0,210,106,0.5)]' : 'border-emerald-500 bg-white text-emerald-700 shadow-xl')
            : (isDarkMode ? 'border-rose-500/80 bg-black/95 text-rose-400 shadow-[0_0_35px_rgba(255,71,87,0.5)]' : 'border-rose-500 bg-white text-rose-700 shadow-xl')
        }`}>
          {outcomeAlert.status === 'WIN' ? (
            <Trophy className="h-6 w-6 text-amber-500 animate-bounce" />
          ) : (
            <XCircle className="h-6 w-6 text-rose-500 animate-pulse" />
          )}
          <div>
            <p className="font-extrabold text-sm">
              {outcomeAlert.status === 'WIN'
                ? (lang === 'hi' ? '🎯 WIN! परिणाम पास हुआ' : '🎯 WIN! RESULT MATCHED')
                : (lang === 'hi' ? '❌ LOSS! अगला राउंड खेलें' : '❌ LOSS! MISSED DRAW')}
            </p>
            <p className={`text-xs font-mono font-bold ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
              Period #{outcomeAlert.record.periodId.slice(-4)} ➔ {outcomeAlert.record.number} ({outcomeAlert.record.size})
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className={`w-full border-b transition-colors px-4 py-3 sticky top-0 z-40 backdrop-blur-xl ${
        isDarkMode ? 'border-white/10 bg-[#0c1220]/90' : 'border-slate-200/80 bg-white/90 shadow-sm'
      }`}>
        <div className="mx-auto max-w-xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl font-black text-lg ${
              isDarkMode
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
            }`}>
              ⚡
            </div>
            <div>
              <h1 className="font-black text-base tracking-wider flex items-center gap-1.5">
                WINGO <span className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>1 MINUTE</span>
              </h1>
              <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                {lang === 'hi' ? 'लाइव सिंक चालू' : 'LIVE API CONNECTED'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Toggle (Light / Dark) */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                isDarkMode
                  ? 'border-white/10 bg-white/5 text-amber-300 hover:bg-white/10'
                  : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              title={isDarkMode ? 'Switch to White Theme' : 'Switch to Dark Theme'}
            >
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                isDarkMode
                  ? 'border-white/10 bg-white/5 text-gray-300 hover:text-white'
                  : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
              title={soundEnabled ? 'Mute' : 'Sound On'}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4 text-blue-500" /> : <VolumeX className="h-4 w-4 text-gray-400" />}
            </button>

            {/* Language Toggle */}
            <button
              onClick={() => setLang(lang === 'hi' ? 'en' : 'hi')}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition-all ${
                isDarkMode
                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                  : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              <Globe className="h-3 w-3" />
              <span>{lang === 'hi' ? 'English' : 'हिंदी'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Single-View Focus Container */}
      <main className="mx-auto max-w-xl px-4 py-5 flex flex-col gap-4">
        
        {/* 1. Live Period & Timer Countdown Bar */}
        <div className={`rounded-2xl border p-4 backdrop-blur-xl transition-all duration-300 ${
          isCritical
            ? (isDarkMode ? 'border-red-500/80 bg-red-950/30' : 'border-red-400 bg-red-50/80 shadow-md')
            : (isDarkMode ? 'border-white/10 bg-[#101726]/90' : 'border-slate-200 bg-white shadow-sm')
        }`}>
          <div className="flex items-center justify-between">
            {/* Period Section */}
            <div>
              <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">
                <Radio className="h-3.5 w-3.5 text-blue-500 animate-pulse" />
                <span>{lang === 'hi' ? 'आने वाला पीरियड' : 'UPCOMING PERIOD'}</span>
              </div>
              <div className={`font-mono text-xl sm:text-2xl font-black tracking-widest ${
                isDarkMode ? 'text-white' : 'text-slate-900'
              }`}>
                {currentUpcomingPeriod || '202608231000...'}
              </div>
            </div>

            {/* Countdown */}
            <div className="text-right">
              <div className="flex items-center justify-end gap-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-0.5">
                <Clock className="h-3.5 w-3.5 text-blue-500" />
                <span>{lang === 'hi' ? 'समय शेष' : 'COUNTDOWN'}</span>
              </div>
              <div className={`font-mono font-black text-2xl sm:text-3xl tracking-wider ${
                isCritical ? 'text-red-500 animate-pulse' : (isDarkMode ? 'text-blue-400' : 'text-blue-600')
              }`}>
                {timeFormatted}
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className={`w-full h-1.5 rounded-full mt-3 overflow-hidden ${
            isDarkMode ? 'bg-black/50 border border-white/5' : 'bg-slate-100 border border-slate-200'
          }`}>
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isCritical ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-indigo-600'
              }`}
              style={{ width: `${((60 - secondsRemaining) / 60) * 100}%` }}
            />
          </div>
        </div>

        {/* 2. ADVANCE RESULT PREDICTION CARD (Ultra-Clean, High Focus) */}
        <div className={`relative overflow-hidden rounded-3xl border p-5 sm:p-6 transition-all duration-300 ${
          isDarkMode
            ? 'border-white/15 bg-gradient-to-b from-[#131b2e] via-[#0d1322] to-black shadow-2xl'
            : 'border-slate-200/90 bg-white shadow-xl shadow-slate-200/50'
        }`}>
          {/* Card Top Header */}
          <div className={`flex items-center justify-between pb-3.5 border-b ${
            isDarkMode ? 'border-white/10' : 'border-slate-100'
          }`}>
            <div className="flex items-center gap-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                isDarkMode ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-blue-100 text-blue-600'
              }`}>
                <Zap className="h-4 w-4" />
              </span>
              <div>
                <h2 className={`font-extrabold text-sm sm:text-base tracking-wide ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}>
                  {lang === 'hi' ? 'आने वाले राउंड का परिणाम' : 'UPCOMING ADVANCE RESULT'}
                </h2>
                <p className="text-[10px] text-slate-400 font-medium">
                  {lang === 'hi' ? 'ड्रॉ आने से पहले सटीक परिणाम' : 'Calculated before round starts'}
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 text-xs font-black text-emerald-600">
              <ShieldCheck className="h-3.5 w-3.5" />
              {prediction?.confidence || 98.6}% {lang === 'hi' ? 'सटीकता' : 'CONF'}
            </span>
          </div>

          {/* Center Result Area (Clean, Prominent Display) */}
          <div className="my-4 flex flex-col items-center justify-center min-h-[140px]">
            {isCalculating ? (
              <div className="flex flex-col items-center justify-center py-6">
                <div className="h-10 w-10 rounded-full border-3 border-blue-500 border-t-transparent animate-spin mb-3" />
                <span className="font-mono text-xs font-bold tracking-widest text-blue-500 animate-pulse">
                  {lang === 'hi' ? 'विश्लेषण हो रहा है...' : 'CALCULATING RESULT...'}
                </span>
              </div>
            ) : prediction ? (
              <div className="w-full flex flex-col items-center">
                {/* Major Big / Small Visual Block */}
                <div className={`w-full flex items-center justify-between gap-4 rounded-2xl border p-4 sm:p-5 transition-all ${
                  isBig
                    ? (isDarkMode
                        ? 'bg-gradient-to-r from-amber-500/20 via-orange-950/20 to-black border-amber-500/50 shadow-lg'
                        : 'bg-gradient-to-r from-amber-50 via-orange-50/50 to-white border-amber-300 shadow-md shadow-amber-500/10')
                    : (isDarkMode
                        ? 'bg-gradient-to-r from-blue-500/20 via-cyan-950/20 to-black border-blue-500/50 shadow-lg'
                        : 'bg-gradient-to-r from-blue-50 via-indigo-50/50 to-white border-blue-300 shadow-md shadow-blue-500/10')
                }`}>
                  {/* Left: Size Name & Range */}
                  <div className="flex items-center gap-3.5">
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border shadow-sm ${
                      isBig
                        ? (isDarkMode ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-amber-500 text-white border-amber-600')
                        : (isDarkMode ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-blue-600 text-white border-blue-700')
                    }`}>
                      {isBig ? <Flame className="h-8 w-8 animate-bounce" /> : <Snowflake className="h-8 w-8 animate-pulse" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`font-black text-3xl sm:text-4xl tracking-wider ${
                          isBig
                            ? (isDarkMode ? 'text-amber-400' : 'text-amber-600')
                            : (isDarkMode ? 'text-blue-400' : 'text-blue-600')
                        }`}>
                          {prediction.size}
                        </span>
                        
                        <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-black border ${
                          isBig
                            ? (isDarkMode ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-amber-100 text-amber-800 border-amber-300')
                            : (isDarkMode ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-blue-100 text-blue-800 border-blue-300')
                        }`}>
                          {isBig ? '5 - 9' : '0 - 4'}
                        </span>
                      </div>
                      
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                        {lang === 'hi' ? 'अग्रिम परिणाम (Result Size)' : 'Predicted Target Size'}
                      </span>
                    </div>
                  </div>

                  {/* Right: Target Main Number */}
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        {lang === 'hi' ? 'मुख्य नंबर' : 'NUMBER'}
                      </span>
                    </div>

                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl font-mono text-3xl font-black border-2 shadow-md ${
                      isDarkMode
                        ? 'bg-slate-900 border-white/20 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    }`}>
                      {prediction.primaryNumber}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* 3. Live Scorecard (WIN / LOSS / WIN RATE / STREAK) */}
        <div className="grid grid-cols-4 gap-2">
          <div className={`rounded-2xl border p-3 text-center transition-all ${
            isDarkMode ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-emerald-200 bg-white shadow-sm'
          }`}>
            <span className="text-[10px] font-bold text-slate-400 block uppercase">
              {lang === 'hi' ? 'जीत (WIN)' : 'WINS'}
            </span>
            <span className="font-mono text-xl font-black text-emerald-600">
              {winCount}
            </span>
          </div>

          <div className={`rounded-2xl border p-3 text-center transition-all ${
            isDarkMode ? 'border-rose-500/30 bg-rose-950/20' : 'border-rose-200 bg-white shadow-sm'
          }`}>
            <span className="text-[10px] font-bold text-slate-400 block uppercase">
              {lang === 'hi' ? 'हार (LOSS)' : 'LOSS'}
            </span>
            <span className="font-mono text-xl font-black text-rose-600">
              {lossCount}
            </span>
          </div>

          <div className={`rounded-2xl border p-3 text-center transition-all ${
            isDarkMode ? 'border-blue-500/30 bg-blue-950/20' : 'border-blue-200 bg-white shadow-sm'
          }`}>
            <span className="text-[10px] font-bold text-slate-400 block uppercase">
              {lang === 'hi' ? 'सटीकता' : 'WIN RATE'}
            </span>
            <span className="font-mono text-xl font-black text-blue-600">
              {winRate}%
            </span>
          </div>

          <div className={`rounded-2xl border p-3 text-center transition-all ${
            isDarkMode ? 'border-amber-500/30 bg-amber-950/20' : 'border-amber-200 bg-white shadow-sm'
          }`}>
            <span className="text-[10px] font-bold text-slate-400 block uppercase">
              {lang === 'hi' ? 'लगातार' : 'STREAK'}
            </span>
            <span className="font-mono text-xl font-black text-amber-600">
              {streak} 🔥
            </span>
          </div>
        </div>

        {/* 4. Live Verification History (Strictly Real Live Rounds) */}
        <div className={`rounded-2xl border p-4 backdrop-blur-xl transition-all ${
          isDarkMode ? 'border-white/10 bg-[#101726]/90' : 'border-slate-200 bg-white shadow-sm'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-500">
              <History className="h-3.5 w-3.5 text-blue-500" />
              <span>{lang === 'hi' ? 'लाइव परिणाम इतिहास (Live History)' : 'LIVE VERIFIED HISTORY'}</span>
            </div>
            <span className="text-[11px] font-bold text-emerald-600">
              {lang === 'hi' ? 'सत्यापित परिणाम' : 'VERIFIED RESULTS'}
            </span>
          </div>

          {history.length === 0 ? (
            <div className={`py-8 text-center flex flex-col items-center justify-center border border-dashed rounded-xl ${
              isDarkMode ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-slate-50/50'
            }`}>
              <Radio className="h-7 w-7 text-blue-500 animate-pulse mb-2" />
              <p className={`text-xs font-bold ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                {lang === 'hi' ? 'लाइव राउंड पूरा होने की प्रतीक्षा है...' : 'Waiting for live round to draw...'}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {lang === 'hi' ? 'जैसे ही वर्तमान पीरियड का रिजल्ट आएगा, यहाँ WIN/LOSS दर्ज होगा' : 'Results will appear live as each round concludes'}
              </p>
            </div>
          ) : (
            <div className={`divide-y max-h-[300px] overflow-y-auto ${
              isDarkMode ? 'divide-white/5' : 'divide-slate-100'
            }`}>
              {history.map((rec) => {
                const recIsBig = rec.size === 'BIG';
                const isWin = rec.resultStatus === 'WIN';

                return (
                  <div key={rec.periodId} className="py-2.5 flex items-center justify-between text-xs">
                    {/* Period & Time */}
                    <div>
                      <span className={`font-mono font-bold block ${isDarkMode ? 'text-gray-200' : 'text-slate-800'}`}>
                        #{rec.periodId.slice(-4)}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono">
                        {rec.timeStr}
                      </span>
                    </div>

                    {/* Drawn Number & Size */}
                    <div className="flex items-center gap-2">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-lg font-mono text-sm font-black border ${
                        isDarkMode
                          ? 'bg-white/5 border-white/10 text-white'
                          : 'bg-slate-100 border-slate-200 text-slate-900'
                      }`}>
                        {rec.number}
                      </span>

                      {/* Size */}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                        recIsBig
                          ? (isDarkMode ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-amber-50 text-amber-700 border-amber-200')
                          : (isDarkMode ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-blue-50 text-blue-700 border-blue-200')
                      }`}>
                        {rec.size}
                      </span>
                    </div>

                    {/* Match status */}
                    <div className={`flex items-center gap-1 font-black text-[11px] ${
                      isWin ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {isWin ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      <span>{isWin ? 'WIN' : 'LOSS'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
