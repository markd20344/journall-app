// Push-to-talk capture on the browser's built-in speech recognition (Chrome
// and Edge on Android/desktop, Safari on iOS 14.5+). Tap once, say what's
// run out, and it stops by itself after a short pause, handing the whole
// transcript back to be split into items.
import { useCallback, useEffect, useRef, useState } from "react";
import { fold } from "./text";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Recognition = any;

const SILENCE_MS = 2500;

export function voiceSupported(): boolean {
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/**
 * Builds the session transcript from every result so far. Each pause starts
 * a new result, and a pause is a natural break between items, so results
 * are joined with commas. Some Android and iOS builds repeat earlier words
 * inside later results in continuous mode; a result that starts with the one
 * before replaces it rather than doubling it up.
 */
export function joinResults(results: string[]): string {
  const segments: string[] = [];
  for (const raw of results) {
    const t = raw.trim();
    if (!t) continue;
    const last = segments[segments.length - 1];
    if (last && fold(t).startsWith(fold(last))) segments[segments.length - 1] = t;
    else if (last && fold(last).startsWith(fold(t))) continue;
    else segments.push(t);
  }
  return segments.join(", ");
}

function errorMessage(code: string): string | null {
  switch (code) {
    case "aborted":
      return null;
    case "no-speech":
      return "Didn't hear anything — tap the mic and try again.";
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access is blocked. Allow it for this site in your browser settings, or use the keyboard's mic.";
    case "audio-capture":
      return "No microphone found.";
    case "network":
      return "Voice needs a connection on this device. Type it instead, or try again when you've got signal.";
    default:
      return `Voice input stopped (${code}).`;
  }
}

export function useVoice(onFinished: (transcript: string) => void) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const textRef = useRef("");
  const cancelledRef = useRef(false);
  const silenceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishedRef = useRef(onFinished);
  useEffect(() => {
    finishedRef.current = onFinished;
  }, [onFinished]);

  const clearSilence = () => {
    if (silenceRef.current) clearTimeout(silenceRef.current);
    silenceRef.current = null;
  };

  const stop = useCallback(() => {
    clearSilence();
    recRef.current?.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    clearSilence();
    recRef.current?.abort();
  }, []);

  const start = useCallback(() => {
    if (recRef.current) return;
    const w = window as unknown as Record<string, unknown>;
    const Ctor = (w.SpeechRecognition || w.webkitSpeechRecognition) as (new () => Recognition) | undefined;
    if (!Ctor) return;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-GB";
    textRef.current = "";
    cancelledRef.current = false;
    setTranscript("");
    setError(null);

    rec.onresult = (event: any) => {
      const parts: string[] = [];
      for (let i = 0; i < event.results.length; i++) parts.push(event.results[i][0].transcript);
      textRef.current = joinResults(parts);
      setTranscript(textRef.current);
      clearSilence();
      silenceRef.current = setTimeout(() => rec.stop(), SILENCE_MS);
    };
    rec.onerror = (event: any) => setError(errorMessage(event.error ?? "unknown"));
    rec.onend = () => {
      clearSilence();
      recRef.current = null;
      setListening(false);
      // Includes any words still interim when it stopped, so tapping "Done"
      // mid-sentence doesn't lose the last item.
      if (!cancelledRef.current && textRef.current.trim()) finishedRef.current(textRef.current);
      textRef.current = "";
      setTranscript("");
    };

    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (err) {
      recRef.current = null;
      setError(err instanceof Error ? err.message : "Couldn't start the microphone.");
    }
  }, []);

  useEffect(() => () => recRef.current?.abort(), []);

  return { listening, transcript, error, clearError: () => setError(null), start, stop, cancel };
}
