import { useEffect, useRef, useState } from "react";
import { createSpeechController, isSpeechRecognitionSupported, type SpeechController } from "../lib/speech";

interface Props {
  // Called for both interim (isFinal=false) and finalized (isFinal=true)
  // speech results, so the caller can show text live as it's spoken.
  onTranscript: (text: string, isFinal: boolean) => void;
  // Fires when a dictation session ends (stop clicked, or the browser ends
  // it on its own) — callers use this to reset their live-preview state so
  // the next session starts from a clean base instead of replaying over it.
  onDictationEnd?: () => void;
}

export default function VoiceButton({ onTranscript, onDictationEnd }: Props) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<SpeechController | null>(null);

  const supported = isSpeechRecognitionSupported();

  useEffect(() => {
    return () => controllerRef.current?.stop();
  }, []);

  function toggle() {
    if (!supported) return;
    if (listening) {
      controllerRef.current?.stop();
      setListening(false);
      return;
    }
    setError(null);
    const controller = createSpeechController({
      onResult: (transcript, isFinal) => {
        onTranscript(transcript, isFinal);
      },
      onEnd: () => {
        setListening(false);
        onDictationEnd?.();
      },
      onError: (message) => {
        setError(message);
        setListening(false);
        onDictationEnd?.();
      },
    });
    if (!controller) return;
    controllerRef.current = controller;
    controller.start();
    setListening(true);
  }

  if (!supported) {
    return (
      <button type="button" className="voice-btn unsupported" disabled title="Voice input isn't supported in this browser (try Chrome or Edge).">
        🎤 Not supported here
      </button>
    );
  }

  return (
    <div className="voice-btn-wrap">
      <button
        type="button"
        className={`voice-btn ${listening ? "listening" : ""}`}
        onClick={toggle}
        title={listening ? "Stop dictation" : "Start dictation"}
      >
        {listening ? "⏹ Stop dictating" : "🎤 Dictate"}
      </button>
      {error && <span className="voice-error">{error}</span>}
    </div>
  );
}
