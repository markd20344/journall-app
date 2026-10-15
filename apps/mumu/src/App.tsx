import type { User } from "firebase/auth";
import { BrowserRouter, Route, Routes } from "react-router";
import AuthGate from "@journall/shared/components/AuthGate";
import ToastHost from "@journall/shared/components/ToastHost";
import UpdatePrompt from "@journall/shared/components/UpdatePrompt";
import { firebaseEnabled } from "@journall/shared/firebase/config";
import Layout from "./components/Layout";
import { OWNER_UID } from "./config";
import { startStore, stopStore } from "./data/store";
import CompaniesPage from "./pages/CompaniesPage";
import CompanyDetailPage from "./pages/CompanyDetailPage";
import CompanyEditPage from "./pages/CompanyEditPage";
import DateEditPage from "./pages/DateEditPage";
import DatesPage from "./pages/DatesPage";
import EngagementDetailPage from "./pages/EngagementDetailPage";
import EngagementEditPage from "./pages/EngagementEditPage";
import EngagementsPage from "./pages/EngagementsPage";
import HomePage from "./pages/HomePage";
import MorePage from "./pages/MorePage";
import NoteEditPage from "./pages/NoteEditPage";
import NotesPage from "./pages/NotesPage";
import NotFound from "./pages/NotFound";
import PeoplePage from "./pages/PeoplePage";
import PersonDetailPage from "./pages/PersonDetailPage";
import PersonEditPage from "./pages/PersonEditPage";
import TrashPage from "./pages/TrashPage";

async function onSignedIn(user: User): Promise<void> {
  startStore(user.uid);
}

function isAllowed(user: User): boolean {
  return !OWNER_UID || user.uid === OWNER_UID;
}

export default function App() {
  if (!firebaseEnabled) {
    return (
      <div className="auth-gate">
        <span className="app-title">Mumu</span>
        <p>Firebase isn't configured for this build. See CLAUDE.md → “Running locally”.</p>
      </div>
    );
  }

  return (
    <AuthGate
      appTitle="Mumu"
      signInPrompt="Your people, companies and notes, in one private place."
      onSignedIn={onSignedIn}
      onSignedOut={stopStore}
      isAllowed={isAllowed}
      forceRedirectInStandalone
    >
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="people" element={<PeoplePage />} />
            <Route path="people/new" element={<PersonEditPage />} />
            <Route path="people/:id" element={<PersonDetailPage />} />
            <Route path="people/:id/edit" element={<PersonEditPage />} />
            <Route path="companies" element={<CompaniesPage />} />
            <Route path="companies/new" element={<CompanyEditPage />} />
            <Route path="companies/:id" element={<CompanyDetailPage />} />
            <Route path="companies/:id/edit" element={<CompanyEditPage />} />
            <Route path="people/:personId/dates/new" element={<DateEditPage />} />
            <Route path="dates" element={<DatesPage />} />
            <Route path="dates/:id/edit" element={<DateEditPage />} />
            <Route path="engagements" element={<EngagementsPage />} />
            <Route path="engagements/new" element={<EngagementEditPage />} />
            <Route path="engagements/:id" element={<EngagementDetailPage />} />
            <Route path="engagements/:id/edit" element={<EngagementEditPage />} />
            <Route path="notes" element={<NotesPage />} />
            <Route path="notes/new" element={<NoteEditPage />} />
            <Route path="notes/:id/edit" element={<NoteEditPage />} />
            <Route path="more" element={<MorePage />} />
            <Route path="trash" element={<TrashPage />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <ToastHost />
      <UpdatePrompt appTitle="Mumu" />
    </AuthGate>
  );
}
