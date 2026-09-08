import ItemBrowser from "../components/ItemBrowser";

export default function LogPage() {
  return (
    <div className="page log-page">
      <h1 className="page-title">Log</h1>
      <p className="settings-hint">
        Lessons learned, actions, risks, assumptions, decisions and calendar bookings — spun off from journal
        entries, or added directly here.
      </p>
      <ItemBrowser />
    </div>
  );
}
