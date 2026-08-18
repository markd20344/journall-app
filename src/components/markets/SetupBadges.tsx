import type { PairAnalysis } from "../../types/markets";

const BREAKOUT_LABEL: Record<string, string> = {
  "closed-breakout-up": "Breakout ↑ (closed)",
  "closed-breakout-down": "Breakout ↓ (closed)",
  "failed-breakout-up": "Breakout ↑ (failed, closed back inside)",
  "failed-breakout-down": "Breakout ↓ (failed, closed back inside)",
};

// Only renders badges for signals that are actually active — a row with no
// setup shows nothing here, so the ones that DO have something jump out.
export default function SetupBadges({ analysis }: { analysis: PairAnalysis }) {
  const { firstDay, insideDay, breakout } = analysis;
  const badges: Array<{ key: string; label: string; title: string; tone: string }> = [];

  if (firstDay) {
    const wary = firstDay.streakLen === 1 || firstDay.streakLen >= 5;
    badges.push({
      key: "firstday",
      label: `${firstDay.type} (${firstDay.streakLen}${firstDay.oppositeDayInPriorWeek ? "*" : ""})`,
      title: `${firstDay.type === "FRD" ? "First Red Day" : "First Green Day"} — broke a ${firstDay.streakLen}-day ${
        firstDay.type === "FRD" ? "green" : "red"
      } streak.${
        firstDay.oppositeDayInPriorWeek
          ? " * An opposite-colored day showed up in the prior week too — less clean."
          : " No opposite-colored day in the prior week — clean run."
      }`,
      tone: wary ? "warn" : firstDay.type === "FRD" ? "red" : "green",
    });
  }

  if (insideDay.isInsideDay) {
    badges.push({ key: "inside", label: "Inside day", title: "Today's range sat fully inside yesterday's.", tone: "neutral" });
  }
  if (insideDay.isOutsideDay) {
    badges.push({ key: "outside", label: "Outside day", title: "Today's range engulfed yesterday's.", tone: "neutral" });
  }

  if (breakout && breakout.state !== "none") {
    const isUp = breakout.state.endsWith("up");
    const isFailed = breakout.state.startsWith("failed");
    badges.push({
      key: "breakout",
      label: BREAKOUT_LABEL[breakout.state],
      title: `${breakout.lookbackDays}-day range: ${breakout.rangeLow.toFixed(5)} - ${breakout.rangeHigh.toFixed(5)}`,
      tone: isFailed ? "warn" : isUp ? "green" : "red",
    });
  }

  if (badges.length === 0) return null;

  return (
    <div className="setup-badges">
      {badges.map((b) => (
        <span key={b.key} className={`setup-badge setup-badge-${b.tone}`} title={b.title}>
          {b.label}
        </span>
      ))}
    </div>
  );
}
