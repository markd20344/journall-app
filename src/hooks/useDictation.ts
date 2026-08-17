import { useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

// Drives a text field live from VoiceButton's interim + final speech results.
// Interim results are re-rendered on top of the field's pre-dictation value
// on every partial update (so text appears as the user speaks), then
// replaced by the properly punctuated/capitalized version once the browser
// finalizes that phrase. `endSession` must be called when dictation stops
// so the next session captures a fresh base instead of replaying over it —
// on prose fields it also runs `finalizeFn` (see dictation.ts's
// ensureSentenceEnd) one last time, since the Web Speech API never leaves a
// transcript with closing punctuation on its own.
export function useDictation(
  setValue: Dispatch<SetStateAction<string>>,
  appendFn: (existing: string, chunk: string) => string,
  finalizeFn?: (text: string) => string,
) {
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
    const wasDictating = baseRef.current !== null;
    baseRef.current = null;
    committedRef.current = "";
    if (wasDictating && finalizeFn) setValue((prev) => finalizeFn(prev));
  }

  return { onTranscript, endSession };
}
