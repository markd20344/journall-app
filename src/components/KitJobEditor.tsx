import { useState, type CSSProperties } from "react";
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

  return (
    <div className="item-editor kit-job-editor">
      <div className="kit-job-editor-header">
        {job.jobNumber && <span className="code-badge">{job.jobNumber}</span>}
        <span className="kit-stage-badge" style={{ "--stage-color": stage.color } as CSSProperties}>
          {stage.label}
        </span>
      </div>

      <label className="field">
        <span className="field-label">Job number</span>
        <input type="text" value={jobNumber} onChange={(e) => setJobNumber(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Name</span>
        <input type="text" className="item-title-input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
      </label>
      <label className="field">
        <span className="field-label">Address</span>
        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} />
      </label>
      <div className="item-editor-row">
        <label className="field">
          <span className="field-label">Postcode</span>
          <input type="text" value={postcode} onChange={(e) => setPostcode(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Visit date</span>
          <input type="date" value={batchDate} onChange={(e) => setBatchDate(e.target.value)} />
        </label>
      </div>
      {(address || postcode) && (
        <a className="kit-maps-link" href={mapsHref} target="_blank" rel="noreferrer">
          📍 Open in Maps
        </a>
      )}

      <div className="field">
        <span className="field-label">Phone numbers</span>
        {phoneNumbers.length > 0 && (
          <div className="chip-row">
            {phoneNumbers.map((phone) => (
              <span key={phone} className="chip">
                <a href={`tel:${phone}`}>{phone}</a>
                <a href={`sms:${phone}`} className="kit-text-link">
                  text
                </a>
                <button type="button" className="chip-remove" aria-label={`Remove ${phone}`} onClick={() => removePhone(phone)}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <input
          type="text"
          placeholder="Add a phone number and press Enter"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            addPhone(e.currentTarget.value);
            e.currentTarget.value = "";
          }}
        />
      </div>

      <label className="field">
        <span className="field-label">Notes</span>
        <textarea className="entry-body" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </label>

      <div className="entry-editor-actions">
        <button type="button" className="primary" disabled={saving} onClick={() => void handleSaveDetails()}>
          Save details
        </button>
        <button type="button" className="ghost" onClick={onClose}>
          Close
        </button>
        <button type="button" className="danger" onClick={handleDelete}>
          Delete
        </button>
      </div>

      {/* --- Contact log --- */}
      <div className="link-section">
        <span className="field-label">Contact attempts</span>
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
      </div>

      {/* --- Door visit log --- */}
      <div className="link-section">
        <span className="field-label">Door visits</span>
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
      </div>

      {/* --- Kit collected --- */}
      <div className="link-section">
        <span className="field-label">Kit collected</span>
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
      </div>

      {/* --- Office email + drop-off --- */}
      <div className="link-section kit-lifecycle-toggles">
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
      </div>
    </div>
  );
}
