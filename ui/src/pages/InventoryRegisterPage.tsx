import { useEffect, useMemo, useState } from "react";
import { createAdminClient } from "../api/client";
import { toast } from "../ui/Toast";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";

type EventSummary = { eventId: string; venueId?: string; universalId?: string; ticketsCount: number };

export function InventoryRegisterPage({ adminKey }: { adminKey: string }) {
  const client = useMemo(() => createAdminClient(adminKey), [adminKey]);
  const [raw, setRaw] = useState<string>('{\n  "event": { "id": "" }\n}\n');
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [lastListError, setLastListError] = useState<string>("");

  async function loadList() {
    setLoadingList(true);
    setLastListError("");
    try {
      const res = await client.get<{ events: EventSummary[] }>("/admin/events");
      setEvents(res.events.filter((e) => !!e.eventId));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLastListError(msg);
      toast("Failed to load events", msg);
    } finally {
      setLoadingList(false);
    }
  }

  async function loadEvent(eventId: string) {
    if (!eventId) return;
    try {
      const res = await client.get<{ event: unknown }>(`/admin/events/${encodeURIComponent(eventId)}`);
      setRaw(JSON.stringify(res.event, null, 2));
      setSelectedEventId(eventId);
      toast("Loaded event", eventId);
    } catch (e) {
      toast("Load failed", e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  async function upsert() {
    setSaving(true);
    try {
      const res = await client.post<{ ok: true; eventId: string }>("/admin/events/upsert", { raw });
      toast("Event upserted", `eventId: ${res.eventId}`);
      setSelectedEventId(res.eventId);
      await loadList();
    } catch (e) {
      toast("Upsert failed", e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card">
      <div className="cardHeader">
        <div className="row">
          <span className="pill">Stored events</span>
          <select
            className="input"
            value={selectedEventId}
            onChange={(e) => loadEvent(e.target.value)}
          >
            <option value="">Select…</option>
            {events.map((e) => (
              <option key={e.eventId} value={e.eventId}>
                {e.eventId} ({e.ticketsCount} tickets)
              </option>
            ))}
          </select>
          <button className="btn" onClick={loadList} disabled={loadingList}>
            Refresh list
          </button>
          <button
            className="btn"
            onClick={() => {
              setSelectedEventId("");
              setRaw('{\n  "event": { "id": "" }\n}\n');
            }}
          >
            New event
          </button>
        </div>
        <div className="row">
          <button className="btn primary" onClick={upsert} disabled={saving || !raw.trim()}>
            {saving ? "Saving…" : "Upsert"}
          </button>
        </div>
      </div>

      <div className="cardBody">
        <div className="hint">
          Paste the event availability JSON here. <code>//</code> comments are allowed.
        </div>
        {lastListError ? (
          <div className="empty" style={{ color: "var(--danger)" }}>
            List error: <span className="mono">{lastListError}</span>
          </div>
        ) : null}
        <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <CodeMirror
            value={raw}
            height="520px"
            theme={oneDark}
            extensions={[
              // JS mode gives a nice JSON-like experience and tolerates `//` comments visually.
              javascript({ typescript: false }),
              EditorView.lineWrapping,
            ]}
            onChange={(value) => setRaw(value)}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLineGutter: true,
              highlightActiveLine: true,
              bracketMatching: true,
              closeBrackets: true,
              autocompletion: false,
            }}
          />
        </div>
      </div>
    </div>
  );
}

