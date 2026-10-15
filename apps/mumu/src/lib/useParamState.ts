import { useSearchParams } from "react-router";

// List filters live in the URL, so Back from a detail page returns to the
// same filtered list, and a filtered view can be bookmarked.
export function useParamState(key: string): [string, (value: string) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? "";
  function set(next: string) {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next) p.set(key, next);
        else p.delete(key);
        return p;
      },
      { replace: true },
    );
  }
  return [value, set];
}
