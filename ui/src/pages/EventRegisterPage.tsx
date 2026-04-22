import { useEffect, useMemo, useState } from "react";
import { createAdminClient } from "../api/client";
import { toast } from "../ui/Toast";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";

type EventDocSummary = { id: string; name?: string; type?: string };

export function EventRegisterPage({ adminKey }: { adminKey: string }) {
  const client = useMemo(() => createAdminClient(adminKey), [adminKey]);
  const [raw, setRaw] = useState<string>('{\n  "id": "",\n  "name": "",\n  "type": "event"\n}\n');
  const [docs, setDocs] = useState<EventDocSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [lastListError, setLastListError] = useState<string>("");

  async function loadList() {
    setLoadingList(true);
    setLastListError("");
    try {
      const res = await client.get<{ docs: EventDocSummary[] }>("/admin/event-docs");
      setDocs(res.docs.filter((d) => !!d.id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLastListError(msg);
      toast("Failed to load event docs", msg);
    } finally {
      setLoadingList(false);
    }
  }

  async function loadDoc(id: string) {
    if (!id) return;
    try {
      const res = await client.get<{ doc: unknown }>(`/admin/event-docs/${encodeURIComponent(id)}`);
      setRaw(JSON.stringify(res.doc, null, 2));
      setSelectedId(id);
      toast("Loaded event doc", id);
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
      const res = await client.post<{ ok: true; id: string }>("/admin/event-docs/upsert", { raw });
      toast("Event doc upserted", `id: ${res.id}`);
      setSelectedId(res.id);
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
          <span className="pill">Stored event docs</span>
          <select className="input" value={selectedId} onChange={(e) => loadDoc(e.target.value)}>
            <option value="">Select…</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.id}
                {d.name ? ` — ${d.name}` : ""}
              </option>
            ))}
          </select>
          <button className="btn" onClick={loadList} disabled={loadingList}>
            Refresh list
          </button>
          <button
            className="btn"
            onClick={() => {
              setSelectedId("");
              setRaw('{\n  "id": "",\n  "name": "",\n  "type": "event"\n}\n');
            }}
          >
            New doc
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
          Paste the full event JSON document (from <code>event.json</code>).
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
            extensions={[javascript({ typescript: false }), EditorView.lineWrapping]}
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

