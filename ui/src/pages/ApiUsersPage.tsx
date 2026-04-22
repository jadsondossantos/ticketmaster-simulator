import { useEffect, useMemo, useState } from "react";
import { createAdminClient } from "../api/client";
import { toast } from "../ui/Toast";

type ApiUser = { id: string; name: string; email: string; token: string; createdAt: string };

export function ApiUsersPage({ adminKey }: { adminKey: string }) {
  const client = useMemo(() => createAdminClient(adminKey), [adminKey]);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", token: "" });

  async function load() {
    setLoading(true);
    try {
      const res = await client.get<{ users: ApiUser[] }>("/admin/api-users");
      setUsers(res.users);
    } catch (e) {
      toast("Failed to load API users", e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  async function create() {
    try {
      await client.post<{ user: ApiUser }>("/admin/api-users", form);
      toast("API user created");
      setForm({ name: "", email: "", token: "" });
      await load();
    } catch (e) {
      toast("Create failed", e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete API user?")) return;
    try {
      await client.del<void>(`/admin/api-users/${id}`);
      toast("API user deleted");
      await load();
    } catch (e) {
      toast("Delete failed", e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="card">
      <div className="cardHeader">
        <div className="row">
          <span className="pill">Create API user</span>
          <input className="input" placeholder="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input className="input" placeholder="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <input className="input" placeholder="token (min 8 chars)" value={form.token} onChange={(e) => setForm((f) => ({ ...f, token: e.target.value }))} />
          <button className="btn primary" onClick={create} disabled={!form.name || !form.email || form.token.length < 8}>
            Create
          </button>
        </div>
        <div className="row">
          <button className="btn" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      <div className="cardBody">
        {users.length === 0 ? (
          <div className="empty">No API users yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Token</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="mono">{u.id}</td>
                  <td>{u.name}</td>
                  <td className="mono">{u.email}</td>
                  <td className="mono">{u.token}</td>
                  <td>
                    <div className="actions">
                      <button className="btn danger" onClick={() => remove(u.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

