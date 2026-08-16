import { useEffect, useRef, useState } from "react";
import { createSpeechController, isSpeechRecognitionSupported, type SpeechController } from "../lib/speech";

interface Props {
  onTranscript: (text: string) => void;
}

export default function VoiceButton({ onTranscript }: Props) {
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
        if (isFinal) {
          onTranscript(transcript);
        }
      },
      onEnd: () => setListening(false),
      onError: (message) => {
        setError(message);
        setListening(false);
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
