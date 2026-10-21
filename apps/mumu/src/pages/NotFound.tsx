import { Link } from "react-router";

export default function NotFound({ what = "page" }: { what?: string }) {
  return (
    <div className="page">
      <p className="empty">
        That {what} doesn't exist, or it's been deleted (check Trash under More).
        <br />
        <Link to="/">Go home</Link>
      </p>
    </div>
  );
}
