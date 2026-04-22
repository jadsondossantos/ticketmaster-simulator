import "./App.css";
import { useAdminKey } from "./state/adminKey";
import { ToastHost } from "./ui/Toast";
import { InventoryRegisterPage } from "./pages/InventoryRegisterPage";
import { ApiUsersPage } from "./pages/ApiUsersPage";
import { useState } from "react";
import { EventRegisterPage } from "./pages/EventRegisterPage";
import { VenueRegisterPage } from "./pages/VenueRegisterPage";

function Shell() {
  const [adminKey, setAdminKey] = useAdminKey();
  const [page, setPage] = useState<"inventory" | "events" | "venues" | "apiUsers">("inventory");

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo" />
          <div>
            <h1>Ticketmaster Simulator</h1>
            <p>Admin console</p>
          </div>
        </div>

        <div className="card mini">
          <div className="cardBody">
            <div className="row">
              <span className="pill">x-admin-key</span>
              <input
                className="input"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="dev-admin-key"
              />
            </div>
            <div className="hint">
              Stored in <code>localStorage</code> as <code>ADMIN_API_KEY</code>.
            </div>
          </div>
        </div>

        <nav className="nav">
          <a className={page === "inventory" ? "active" : ""} href="#"
            onClick={(e) => {
              e.preventDefault();
              setPage("inventory");
            }}
          >
            Event inventory
          </a>
          <a className={page === "events" ? "active" : ""} href="#"
            onClick={(e) => {
              e.preventDefault();
              setPage("events");
            }}
          >
            Register event
          </a>
          <a className={page === "venues" ? "active" : ""} href="#"
            onClick={(e) => {
              e.preventDefault();
              setPage("venues");
            }}
          >
            Register venue
          </a>
          <a className={page === "apiUsers" ? "active" : ""} href="#"
            onClick={(e) => {
              e.preventDefault();
              setPage("apiUsers");
            }}
          >
            API users
          </a>
        </nav>

        <div className="foot">
          <div className="pill">
            Backend: <code>/admin/*</code>
          </div>
        </div>
      </aside>

      <main className="content">
        <div className="topbar">
          <div className="title">
            <h2>
              {page === "inventory"
                ? "Register event inventory"
                : page === "events"
                  ? "Register event"
                  : page === "venues"
                    ? "Register venue"
                    : "Register API users"}
            </h2>
            <div className="subtitle">
              {page === "inventory"
                ? "Paste the availability JSON and upsert"
                : page === "events"
                  ? "Paste the event JSON and upsert"
                  : page === "venues"
                    ? "Paste the venue JSON and upsert"
                    : "Create tokens that can call the partner API"}
            </div>
          </div>
        </div>
        {page === "inventory" ? (
          <InventoryRegisterPage adminKey={adminKey} />
        ) : page === "events" ? (
          <EventRegisterPage adminKey={adminKey} />
        ) : page === "venues" ? (
          <VenueRegisterPage adminKey={adminKey} />
        ) : (
          <ApiUsersPage adminKey={adminKey} />
        )}
      </main>

      <ToastHost />
    </div>
  );
}

export default function App() {
  return <Shell />;
}
