// Thin wrapper around the browser's Web Speech API (SpeechRecognition).
// This is a "phase 1" feature: it relies entirely on built-in browser support
// rather than a custom speech pipeline. Chrome/Edge (desktop + Android) have
// solid support; Safari/iOS support is inconsistent and may be unavailable
// or require a permission prompt each time.

export interface SpeechController {
  start: () => void;
  stop: () => void;
}

export function isSpeechRecognitionSupported(): boolean {
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

export function createSpeechController(handlers: {
  onResult: (transcript: string, isFinal: boolean) => void;
  onEnd: () => void;
  onError: (message: string) => void;
}): SpeechController | null {
  const w = window as unknown as Record<string, unknown>;
  const SpeechRecognitionCtor = (w.SpeechRecognition || w.webkitSpeechRecognition) as
    | (new () => any) // eslint-disable-line @typescript-eslint/no-explicit-any
    | undefined;
  if (!SpeechRecognitionCtor) return null;

  const recognition = new SpeechRecognitionCtor();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || "en-US";

  recognition.onresult = (event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    let finalText = "";
    let interimText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalText += result[0].transcript;
      } else {
        interimText += result[0].transcript;
      }
    }
    if (finalText) handlers.onResult(finalText, true);
    if (interimText) handlers.onResult(interimText, false);
  };

  recognition.onerror = (event: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    handlers.onError(event.error ?? "Speech recognition error");
  };

  recognition.onend = () => handlers.onEnd();

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
  };
}
