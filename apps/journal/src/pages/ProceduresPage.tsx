import ProcedureBrowser from "../components/ProcedureBrowser";

export default function ProceduresPage() {
  return (
    <div className="page procedures-page">
      <h1 className="page-title">Procedures</h1>
      <p className="settings-hint">
        Step-by-step how-tos for things you only do once in a while and forget — dictate each step as you think of
        it, then look it up next time instead of relearning it from scratch.
      </p>
      <ProcedureBrowser />
    </div>
  );
}
