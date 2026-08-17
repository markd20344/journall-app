import { useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

// Drives a text field live from VoiceButton's interim + final speech results.
// Interim results are re-rendered on top of the field's pre-dictation value
// on every partial update (so text appears as the user speaks), then
// replaced by the properly punctuated/capitalized version once the browser
// finalizes that phrase. `endSession` must be called when dictation stops
// so the next session captures a fresh base instead of replaying over it.
export function useDictation(setValue: Dispatch<SetStateAction<string>>, appendFn: (existing: string, chunk: string) => string) {
  const baseRef = useRef<string | null>(null);
  const committedRef = useRef("");

  function onTranscript(text: string, isFinal: boolean) {
    setValue((prev) => {
      if (baseRef.current === null) {
        baseRef.current = prev;
        committedRef.current = "";
      }
      const base = baseRef.current;
      if (isFinal) {
        committedRef.current = appendFn(committedRef.current, text);
        return appendFn(base, committedRef.current);
      }
      return appendFn(appendFn(base, committedRef.current), text);
    });
  }

  function endSession() {
    baseRef.current = null;
    committedRef.current = "";
  }

  return { onTranscript, endSession };
}
