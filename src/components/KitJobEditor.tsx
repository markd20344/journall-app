import { useState, type CSSProperties, type ReactNode } from "react";
import { format } from "date-fns";
import type { ContactOutcome, DoorVisitOutcome, KitCollected, KitJob } from "../types/kit";
import {
  addContactAttempt,
  addDoorVisit,
  deleteContactAttempt,
  deleteDoorVisit,
  deleteKitJob,
  markDroppedOff,
  setKitCollected as saveKitCollected,
  setOfficeEmailed,
  unmarkDroppedOff,
  updateKitJob,
} from "../db/kitRepo";
import { compressImageToDataUrl } from "../lib/photo";
import { followUpMessage, initialContactMessage, smsHref } from "../lib/kitSms";
import { showToast } from "../lib/toast";
import { schedulePendingDelete, cancelPendingDelete } from "../lib/pendingDelete";
import { CONTACT_OUTCOME_META, CONTACT_OUTCOME_ORDER, deriveStage, DOOR_VISIT_OUTCOME_META, STAGE_META } from "../lib/kitStage";
import { nowIso } from "../lib/id";
import Dropdown from "./Dropdown";

interface Props {
  job: KitJob;
  onClose: () => void;
  onDeleted: () => void;
}

const EMPTY_KIT: Omit<KitCollected, "loggedAt"> = {
  rucksack: false,
  tablets: 0,
  phones: 0,
  fuelCards: 0,
  idCards: 0,
  numberPlates: 0,
  other: "",
};

function CountStepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="kit-count-stepper">
      <span className="kit-count-label">{label}</span>
      <div className="kit-count-controls">
        <button type="button" disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))}>
          −
        </button>
        <span className="kit-count-value">{value}</span>
        <button type="button" onClick={() => onChange(value + 1)}>
          +
        </button>
      </div>
    </div>
  );
}

/** A collapsed-by-default section with a one-line summary, so the editor stays short until you actually need to log something. */
function Section({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="kit-section">
      <button type="button" className="kit-section-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="kit-section-title">{title}</span>
        <span className="kit-section-right">
          {!open && <span className="kit-section-summary">{summary}</span>}
          <span className="kit-section-chevron">{open ? "▾" : "▸"}</span>
        </span>
      </button>
      {open && <div className="kit-section-body">{children}</div>}
    </div>
  );
}

function kitCollectedSummary(kit: Omit<KitCollected, "loggedAt"> | null): string {
  if (!kit) return "Not yet";
  const parts: string[] = [];
  if (kit.rucksack) parts.push("Rucksack");
  if (kit.tablets > 0) parts.push(`${kit.tablets} tablet${kit.tablets === 1 ? "" : "s"}`);
  if (kit.phones > 0) parts.push(`${kit.phones} phone${kit.phones === 1 ? "" : "s"}`);
  if (kit.fuelCards > 0) parts.push(`${kit.fuelCards} fuel card${kit.fuelCards === 1 ? "" : "s"}`);
  if (kit.idCards > 0) parts.push(`${kit.idCards} ID card${kit.idCards === 1 ? "" : "s"}`);
  if (kit.numberPlates > 0) parts.push(`${kit.numberPlates} plate${kit.numberPlates === 1 ? "" : "s"}`);
  if (kit.other) parts.push(kit.other);
  return parts.length > 0 ? parts.join(", ") : "Nothing";
}

export default function KitJobEditor({ job, onClose, onDeleted }: Props) {
  const [jobNumber, setJobNumber] = useState(job.jobNumber);
  const [customerName, setCustomerName] = useState(job.customerName);
  const [address, setAddress] = useState(job.address);
  const [postcode, setPostcode] = useState(job.postcode);
  const [batchDate, setBatchDate] = useState(job.batchDate);
  const [phoneNumbers, setPhoneNumbers] = useState(job.phoneNumbers);
  const [notes, setNotes] = useState(job.notes);
  const [saving, setSaving] = useState(false);

  const [contactAttempts, setContactAttempts] = useState(job.contactAttempts);
  const [attemptPhone, setAttemptPhone] = useState(phoneNumbers[0] ?? "");
  const [attemptOutcome, setAttemptOutcome] = useState<ContactOutcome>("no_response");
  const [attemptNote, setAttemptNote] = useState("");

  const [visits, setVisits] = useState(job.visits);
  const [visitOutcome, setVisitOutcome] = useState<DoorVisitOutcome>("no_answer");
  const [visitNote, setVisitNote] = useState("");
  const [visitPhoto, setVisitPhoto] = useState<string | null>(null);
  const [photoProcessing, setPhotoProcessing] = useState(false);

  const [kitCollected, setKitCollectedState] = useState<KitCollected | null>(job.kitCollected);
  const [editingKit, setEditingKit] = useState(!job.kitCollected);
  const [kitDraft, setKitDraft] = useState<Omit<KitCollected, "loggedAt">>(job.kitCollected ?? EMPTY_KIT);

  const [officeEmailedAt, setOfficeEmailedAt] = useState(job.officeEmailedAt);
  const [droppedOffAt, setDroppedOffAt] = useState(job.droppedOffAt);

  const stage = STAGE_META[deriveStage({ ...job, contactAttempts, visits, kitCollected, officeEmailedAt, droppedOffAt })];
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address} ${postcode}`.trim())}`;

  async function handleSaveDetails() {
    setSaving(true);
    try {
      await updateKitJob(job.id, {
        jobNumber: jobNumber.trim(),
        customerName: customerName.trim(),
        address: address.trim(),
        postcode: postcode.trim().toUpperCase(),
        phoneNumbers,
        notes,
        batchDate,
      });
      showToast("Job saved");
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    const id = job.id;
    const name = job.customerName || "job";
    schedulePendingDelete("kitJob", id, () => deleteKitJob(id));
    showToast(`Deleted "${name}"`, { action: { label: "Undo", onClick: () => cancelPendingDelete("kitJob", id) }, durationMs: 5000 });
    onDeleted();
  }

  function addPhone(phone: string) {
    const trimmed = phone.trim();
    if (!trimmed || phoneNumbers.includes(trimmed)) return;
    setPhoneNumbers((prev) => [...prev, trimmed]);
  }

  function removePhone(phone: string) {
    setPhoneNumbers((prev) => prev.filter((p) => p !== phone));
  }

  async function logAttempt() {
    if (!attemptPhone.trim()) return;
    const created = await addContactAttempt(job.id, { phoneNumber: attemptPhone.trim(), outcome: attemptOutcome, note: attemptNote.trim() });
    if (created) {
      setContactAttempts((prev) => [...prev, created]);
      setAttemptNote("");
    }
  }

  async function removeAttempt(attemptId: string) {
    setContactAttempts((prev) => prev.filter((a) => a.id !== attemptId));
    await deleteContactAttempt(job.id, attemptId);
  }

  async function handlePhotoSelected(file: File | undefined) {
    if (!file) return;
    setPhotoProcessing(true);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      setVisitPhoto(dataUrl);
    } catch {
      showToast("Couldn't process that photo");
    } finally {
      setPhotoProcessing(false);
    }
  }

  async function logVisit() {
    const created = await addDoorVisit(job.id, { outcome: visitOutcome, note: visitNote.trim(), photoDataUrl: visitPhoto });
    if (created) {
      setVisits((prev) => [...prev, created]);
      setVisitNote("");
      setVisitPhoto(null);
    }
  }

  async function removeVisit(visitId: string) {
    setVisits((prev) => prev.filter((v) => v.id !== visitId));
    await deleteDoorVisit(job.id, visitId);
  }

  async function saveKit() {
    await saveKitCollected(job.id, kitDraft);
    setKitCollectedState({ ...kitDraft, loggedAt: nowIso() });
    setEditingKit(false);
  }

  async function toggleOfficeEmailed() {
    const next = !officeEmailedAt;
    setOfficeEmailedAt(next ? nowIso() : null);
    await setOfficeEmailed(job.id, next);
  }

  async function toggleDroppedOff() {
    if (droppedOffAt) {
      setDroppedOffAt(null);
      await unmarkDroppedOff(job.id);
    } else {
      const ts = nowIso();
      setDroppedOffAt(ts);
      await markDroppedOff([job.id]);
    }
  }

  const contactSummary =
    contactAttempts.length === 0
      ? "None yet"
      : `${contactAttempts.length} · ${CONTACT_OUTCOME_META[contactAttempts[contactAttempts.length - 1].outcome].label}`;
  const visitSummary =
    visits.length === 0 ? "Not visited" : `${visits.length} · ${DOOR_VISIT_OUTCOME_META[visits[visits.length - 1].outcome].label}`;
  const lifecycleSummary = `${officeEmailedAt ? "Emailed" : "Not emailed"} · ${droppedOffAt ? "Dropped off" : "Not dropped off"}`;

  return (
    <div className="item-editor kit-job-editor">
      <div className="kit-job-editor-header">
        {job.jobNumber && <span className="code-badge">{job.jobNumber}</span>}
        <span className="kit-stage-badge" style={{ "--stage-color": stage.color } as CSSProperties}>
          {stage.label}
        </span>
      </div>

      <input
        type="text"
        className="item-title-input"
        placeholder="Name"
        value={customerName}
        onChange={(e) => setCustomerName(e.target.value)}
      />

      <input type="text" className="kit-address-input" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />

      <div className="kit-postcode-row">
        <input
          type="text"
          className="kit-postcode-input"
          placeholder="Postcode"
          value={postcode}
          onChange={(e) => setPostcode(e.target.value)}
        />
        {(address || postcode) && (
          <a className="kit-maps-icon-btn" href={mapsHref} target="_blank" rel="noreferrer" aria-label="Open in Maps">
            📍 Open in Maps
          </a>
        )}
      </div>

      <div className="kit-phone-row">
        {phoneNumbers.map((phone) => (
          <span key={phone} className="chip">
            <a href={`tel:${phone}`}>{phone}</a>
            <a href={smsHref(phone, initialContactMessage(customerName))} className="kit-text-link">
              text
            </a>
            <a href={smsHref(phone, followUpMessage(customerName))} className="kit-text-link">
              reply
            </a>
            <button type="button" className="chip-remove" aria-label={`Remove ${phone}`} onClick={() => removePhone(phone)}>
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          className="kit-add-phone-input"
          placeholder="+ phone"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            addPhone(e.currentTarget.value);
            e.currentTarget.value = "";
          }}
        />
      </div>

      <div className="entry-editor-actions">
        <button type="button" className="primary" disabled={saving} onClick={() => void handleSaveDetails()}>
          Save
        </button>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
        <button type="button" className="danger" onClick={handleDelete}>
          Delete
        </button>
      </div>

      <Section title="Notes (in report)" summary={notes.trim() ? notes.trim() : "None"}>
        <p className="settings-hint small">
          Anything worth flagging for this person — a duplicate number, a different person answering, "not back until
          Christmas," etc. Works whether or not they have a phone number on file, and is included in the daily summary
          email.
        </p>
        <textarea
          className="entry-body"
          placeholder="e.g. Different person answered this number — may be a duplicate with another job today."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
        <div className="entry-editor-actions">
          <button type="button" className="primary" disabled={saving} onClick={() => void handleSaveDetails()}>
            Save note
          </button>
        </div>
      </Section>

      <Section title="Contact attempts" summary={contactSummary}>
        {contactAttempts.length > 0 && (
          <ul className="status-update-list">
            {contactAttempts.map((a) => (
              <li key={a.id} className="status-update-row">
                <span className="status-update-time">{format(new Date(a.createdAt), "MMM d, h:mm a")}</span>
                <span
                  className="kit-outcome-pill"
                  style={{ "--stage-color": CONTACT_OUTCOME_META[a.outcome].color } as CSSProperties}
                >
                  {CONTACT_OUTCOME_META[a.outcome].label}
                </span>
                <span className="status-update-note">
                  {a.phoneNumber}
                  {a.note ? ` — ${a.note}` : ""}
                </span>
                <button type="button" className="chip-remove" aria-label="Delete attempt" onClick={() => void removeAttempt(a.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="kit-log-form">
          <Dropdown
            value={attemptPhone}
            onChange={setAttemptPhone}
            options={
              phoneNumbers.length > 0
                ? phoneNumbers.map((p) => ({ value: p, label: p }))
                : [{ value: "", label: "No phone number yet" }]
            }
          />
          <Dropdown
            value={attemptOutcome}
            onChange={(v) => setAttemptOutcome(v as ContactOutcome)}
            options={CONTACT_OUTCOME_ORDER.map((o) => ({ value: o, label: CONTACT_OUTCOME_META[o].label }))}
          />
          <input type="text" placeholder="Note (optional)" value={attemptNote} onChange={(e) => setAttemptNote(e.target.value)} />
          <button type="button" className="primary" disabled={!attemptPhone.trim()} onClick={() => void logAttempt()}>
            Log attempt
          </button>
        </div>
      </Section>

      <Section title="Door visits" summary={visitSummary}>
        {visits.length > 0 && (
          <ul className="status-update-list">
            {visits.map((v) => (
              <li key={v.id} className="status-update-row kit-visit-row">
                <span className="status-update-time">{format(new Date(v.createdAt), "MMM d, h:mm a")}</span>
                <span
                  className="kit-outcome-pill"
                  style={{ "--stage-color": DOOR_VISIT_OUTCOME_META[v.outcome].color } as CSSProperties}
                >
                  {DOOR_VISIT_OUTCOME_META[v.outcome].label}
                </span>
                <span className="status-update-note">{v.note}</span>
                {v.photoDataUrl && <img className="kit-visit-photo" src={v.photoDataUrl} alt="Door, no answer" />}
                <button type="button" className="chip-remove" aria-label="Delete visit" onClick={() => void removeVisit(v.id)}>
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="kit-log-form">
          <Dropdown
            value={visitOutcome}
            onChange={(v) => setVisitOutcome(v as DoorVisitOutcome)}
            options={[
              { value: "answered", label: "Answered" },
              { value: "no_answer", label: "No answer" },
            ]}
          />
          <input type="text" placeholder="Note (optional)" value={visitNote} onChange={(e) => setVisitNote(e.target.value)} />
          <label className="kit-photo-btn">
            {photoProcessing ? "Processing…" : visitPhoto ? "📷 Photo attached" : "📷 Add photo"}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => void handlePhotoSelected(e.target.files?.[0])}
            />
          </label>
          <button type="button" className="primary" onClick={() => void logVisit()}>
            Log visit
          </button>
        </div>
      </Section>

      <Section title="Kit collected" summary={kitCollected ? kitCollectedSummary(kitCollected) : "Not yet"}>
        {!editingKit && kitCollected ? (
          <div className="kit-summary-box">
            <ul className="kit-summary-list">
              {kitCollected.rucksack && <li>Rucksack</li>}
              {kitCollected.tablets > 0 && <li>{kitCollected.tablets} tablet(s)</li>}
              {kitCollected.phones > 0 && <li>{kitCollected.phones} phone(s)</li>}
              {kitCollected.fuelCards > 0 && <li>{kitCollected.fuelCards} fuel card(s)</li>}
              {kitCollected.idCards > 0 && <li>{kitCollected.idCards} ID card(s)</li>}
              {kitCollected.numberPlates > 0 && <li>{kitCollected.numberPlates} number plate(s)</li>}
              {kitCollected.other && <li>{kitCollected.other}</li>}
            </ul>
            <p className="entry-timestamp">Logged {format(new Date(kitCollected.loggedAt), "MMM d, h:mm a")}</p>
            <button type="button" className="ghost" onClick={() => setEditingKit(true)}>
              Edit
            </button>
          </div>
        ) : (
          <div className="kit-collected-form">
            <label className="kit-rucksack-check">
              <input
                type="checkbox"
                checked={kitDraft.rucksack}
                onChange={(e) => setKitDraft((prev) => ({ ...prev, rucksack: e.target.checked }))}
              />
              Rucksack
            </label>
            <CountStepper label="Tablets" value={kitDraft.tablets} onChange={(v) => setKitDraft((prev) => ({ ...prev, tablets: v }))} />
            <CountStepper label="Phones" value={kitDraft.phones} onChange={(v) => setKitDraft((prev) => ({ ...prev, phones: v }))} />
            <CountStepper
              label="Fuel cards"
              value={kitDraft.fuelCards}
              onChange={(v) => setKitDraft((prev) => ({ ...prev, fuelCards: v }))}
            />
            <CountStepper label="ID cards" value={kitDraft.idCards} onChange={(v) => setKitDraft((prev) => ({ ...prev, idCards: v }))} />
            <CountStepper
              label="Number plates"
              value={kitDraft.numberPlates}
              onChange={(v) => setKitDraft((prev) => ({ ...prev, numberPlates: v }))}
            />
            <label className="field">
              <span className="field-label">Other</span>
              <input
                type="text"
                placeholder="Anything else that came back…"
                value={kitDraft.other}
                onChange={(e) => setKitDraft((prev) => ({ ...prev, other: e.target.value }))}
              />
            </label>
            <div className="entry-editor-actions">
              <button type="button" className="primary" onClick={() => void saveKit()}>
                Save kit collected
              </button>
              {kitCollected && (
                <button type="button" className="ghost" onClick={() => setEditingKit(false)}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </Section>

      <Section title="Office email & drop-off" summary={lifecycleSummary}>
        <label className="kit-toggle-row">
          <input type="checkbox" checked={Boolean(officeEmailedAt)} onChange={() => void toggleOfficeEmailed()} />
          <span>
            Included in the evening office email
            {officeEmailedAt && <span className="entry-timestamp"> — {format(new Date(officeEmailedAt), "MMM d, h:mm a")}</span>}
          </span>
        </label>
        <label className="kit-toggle-row">
          <input type="checkbox" checked={Boolean(droppedOffAt)} onChange={() => void toggleDroppedOff()} disabled={!kitCollected} />
          <span>
            Dropped off at BCA Corby
            {droppedOffAt && <span className="entry-timestamp"> — {format(new Date(droppedOffAt), "MMM d, h:mm a")}</span>}
          </span>
        </label>
      </Section>

      <Section title="Details" summary={`${jobNumber || "no job #"} · ${batchDate}`}>
        <div className="item-editor-row">
          <label className="field">
            <span className="field-label">Job number</span>
            <input type="text" value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Visit date</span>
            <input type="date" value={batchDate} onChange={(e) => setBatchDate(e.target.value)} />
          </label>
        </div>
        <div className="entry-editor-actions">
          <button type="button" className="primary" disabled={saving} onClick={() => void handleSaveDetails()}>
            Save
          </button>
        </div>
      </Section>
    </div>
  );
}
