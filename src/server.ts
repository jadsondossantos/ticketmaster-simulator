import Fastify, { type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { z, ZodError } from "zod";
import path from "node:path";
import fs from "node:fs";
import { openDb, type EventCatalogDoc, type VenueDoc } from "./docdb.js";
import { parseLenientJson } from "./lenientJson.js";
import crypto from "node:crypto";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3100),
  ADMIN_API_KEY: z.string().min(1).default("dev-admin-key"),
  PARTNER_API_KEY: z.string().min(1).default("dev-api-key"),
});

const apiKeyQuerySchema = z.object({
  apiKey: z.string().min(1),
});

const availabilityParamsSchema = z.object({
  eventId: z.string().min(1),
});

const server = Fastify({
  logger: false,
});

await server.register(cors, { origin: true });

const db = await openDb();

function partnerTokenValid(apiKey: string): boolean {
  return Object.values(db.data.apiUsers).some((u) => u.token === apiKey);
}

function venueSearchHaystack(venue: VenueDoc): string {
  const parts: string[] = [];
  function walk(x: unknown, depth: number): void {
    if (depth > 16) return;
    if (typeof x === "string") {
      parts.push(x);
      return;
    }
    if (Array.isArray(x)) {
      for (const item of x) walk(item, depth + 1);
      return;
    }
    if (x !== null && typeof x === "object") {
      for (const v of Object.values(x as Record<string, unknown>)) {
        walk(v, depth + 1);
      }
    }
  }
  walk(venue as unknown, 0);
  return parts.join(" ").toLowerCase();
}

function tokenMatchesHaystack(haystack: string, token: string): boolean {
  if (!token) return true;
  if (haystack.includes(token)) return true;
  if (token.length > 3 && token.endsWith("s")) {
    const stem = token.slice(0, -1);
    if (haystack.includes(stem)) return true;
  }
  return false;
}

function venueMatchesKeyword(venue: VenueDoc, keyword: string): boolean {
  const raw = keyword.trim().toLowerCase();
  if (!raw) return true;
  const haystack = venueSearchHaystack(venue);
  const tokens = raw.split(/\s+/).filter(Boolean);
  return tokens.every((t) => tokenMatchesHaystack(haystack, t));
}

function venueIdInVenueHref(href: string, venueId: string): boolean {
  const base = href.split("?")[0] ?? href;
  return base.endsWith(`/venues/${venueId}`);
}

function eventCatalogDocMatchesVenue(doc: EventCatalogDoc, venueId: string): boolean {
  const emb = doc._embedded;
  if (emb && typeof emb === "object" && "venues" in emb) {
    const venues = (emb as { venues?: unknown }).venues;
    if (Array.isArray(venues)) {
      for (const v of venues) {
        if (v && typeof v === "object" && "id" in v && typeof (v as { id: unknown }).id === "string") {
          if ((v as { id: string }).id === venueId) return true;
        }
      }
    }
  }
  const links = doc._links;
  if (links && typeof links === "object" && "venues" in links) {
    const linkVenues = (links as { venues?: unknown }).venues;
    if (Array.isArray(linkVenues)) {
      for (const l of linkVenues) {
        if (l && typeof l === "object" && "href" in l && typeof (l as { href: unknown }).href === "string") {
          if (venueIdInVenueHref((l as { href: string }).href, venueId)) return true;
        }
      }
    }
  }
  return false;
}

function eventIdsForVenue(
  events: Record<string, { event?: { venueId?: string } }>,
  eventDocs: Record<string, EventCatalogDoc>,
  venueId: string,
): string[] {
  const ids = new Set<string>();
  for (const [id, doc] of Object.entries(events)) {
    if (doc.event?.venueId === venueId) ids.add(id);
  }
  for (const [id, doc] of Object.entries(eventDocs)) {
    if (eventCatalogDocMatchesVenue(doc, venueId)) ids.add(id);
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

server.setErrorHandler(async (err, _request, reply) => {
  if (err instanceof ZodError) {
    return reply.code(400).send({
      error: "validation_error",
      issues: err.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  console.error(err);
  return reply.code(500).send({ error: "internal_server_error" });
});

server.get(
  "/partners/v1/events/:eventId/availability",
  async (request, reply) => {
    const { apiKey } = apiKeyQuerySchema.parse(request.query);
    const { eventId } = availabilityParamsSchema.parse(request.params);

    await db.read();
    if (!partnerTokenValid(apiKey)) {
      return reply.code(401).send({ error: "invalid_api_key" });
    }

    const doc = db.data.events[eventId];
    if (!doc) {
      return reply.code(404).send({ error: "event_not_found" });
    }
    return reply.code(200).send(doc);
  },
);

server.get(
  "/partners/v1/events/:eventId",
  async (request, reply) => {
    const { apiKey } = apiKeyQuerySchema.parse(request.query);
    const { eventId } = availabilityParamsSchema.parse(request.params);

    await db.read();
    if (!partnerTokenValid(apiKey)) {
      return reply.code(401).send({ error: "invalid_api_key" });
    }

    const doc = db.data.eventDocs[eventId];
    if (!doc) {
      return reply.code(404).send({ error: "event_not_found" });
    }
    return reply.code(200).send(doc);
  },
);

const venuesJsonQuerySchema = z.object({
  apiKey: z.string().min(1),
  keyword: z.string().optional(),
});

/** Discovery-style query: lowercase `apikey`, optional `locale` & `size` (page size). */
const discoveryVenuesJsonQuerySchema = z.object({
  apikey: z.string().min(1),
  keyword: z.string().optional(),
  locale: z.string().optional(),
  size: z.coerce.number().int().positive().max(500).optional(),
});

const discoveryEventsJsonQuerySchema = z.object({
  venueId: z.string().optional(),
  apikey: z.string().min(1),
  locale: z.string().optional(),
  size: z.coerce.number().int().positive().max(500).optional(),
});

async function sendVenuesEmbedded(
  reply: FastifyReply,
  apiKey: string,
  keyword?: string,
  size?: number,
) {
  await db.read();
  if (!partnerTokenValid(apiKey)) {
    return reply.code(401).send({ error: "invalid_api_key" });
  }
  let list = Object.values(db.data.venues);
  if (keyword !== undefined && keyword.trim() !== "") {
    list = list.filter((v) => venueMatchesKeyword(v, keyword));
  }
  if (size !== undefined) {
    list = list.slice(0, size);
  }
  return reply.code(200).type("application/json").send({
    _embedded: { venues: list },
  });
}

server.get("/venues.json", async (request, reply) => {
  const { apiKey, keyword } = venuesJsonQuerySchema.parse(request.query);
  return sendVenuesEmbedded(reply, apiKey, keyword);
});

server.get("/discovery/v2/venues.json", async (request, reply) => {
  const q = discoveryVenuesJsonQuerySchema.parse(request.query);
  const pageSize = q.size ?? 10;
  return sendVenuesEmbedded(reply, q.apikey, q.keyword, pageSize);
});

server.get("/discovery/v2/events.json", async (request, reply) => {
  const q = discoveryEventsJsonQuerySchema.parse(request.query);
  const pageSize = q.size ?? 100;
  await db.read();
  if (!partnerTokenValid(q.apikey)) {
    return reply.code(401).send({ error: "invalid_api_key" });
  }
  const venueFilter = q.venueId?.trim();
  const orderedIds = venueFilter
    ? eventIdsForVenue(db.data.events, db.data.eventDocs, venueFilter)
    : Object.keys(db.data.eventDocs).sort((a, b) => a.localeCompare(b));
  let list: EventCatalogDoc[] = [];
  for (const id of orderedIds) {
    const doc = db.data.eventDocs[id];
    if (doc) list.push(doc);
    if (list.length >= pageSize) break;
  }
  return reply.code(200).type("application/json").send({
    _embedded: { events: list },
  });
});

server.get("/health", async () => ({ ok: true }));

const { PORT, ADMIN_API_KEY } = envSchema.parse(process.env);

function assertAdminKey(request: { headers: Record<string, unknown> }, reply: { code: (c: number) => { send: (b: unknown) => unknown } }) {
  const raw = request.headers["x-admin-key"];
  const adminKey = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
  if (!adminKey || adminKey !== ADMIN_API_KEY) {
    reply.code(401).send({ error: "invalid_admin_key" });
    return false;
  }
  return true;
}

const idParamSchema = z.object({ id: z.string().min(1) });

const adminEventsQuerySchema = z.object({
  venueId: z.string().optional(),
});

// -------------------------
// Admin API (for UI later)
// -------------------------

server.get("/admin/health", async (request, reply) => {
  if (!assertAdminKey(request, reply)) return;
  return reply.code(200).send({ ok: true });
});

// Document-based Events (inventory registration)
const availabilityDocSchema = z.object({
  event: z.object({
    id: z.string().min(1),
  }).passthrough(),
}).passthrough();

const eventCatalogDocSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  type: z.string().optional(),
}).passthrough();

const venueDocSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  type: z.string().optional(),
}).passthrough();

const apiUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  token: z.string().min(8),
});

server.post("/admin/events/upsertDoc", async (request, reply) => {
  if (!assertAdminKey(request, reply)) return;
  const body = z.object({ doc: availabilityDocSchema }).parse(request.body);
  const doc = body.doc;

  await db.read();
  db.data.events[doc.event.id] = doc;
  await db.write();

  return reply.code(200).send({ ok: true, eventId: doc.event.id });
});

// API Users (token holders for partner API)
server.get("/admin/api-users", async (request, reply) => {
  if (!assertAdminKey(request, reply)) return;
  await db.read();
  const users = Object.values(db.data.apiUsers).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return reply.code(200).send({ users });
});

server.post("/admin/api-users", async (request, reply) => {
  if (!assertAdminKey(request, reply)) return;
  const body = apiUserSchema.parse(request.body);
  await db.read();

  const tokenExists = Object.values(db.data.apiUsers).some((u) => u.token === body.token);
  if (tokenExists) return reply.code(409).send({ error: "token_already_exists" });

  const id = crypto.randomUUID();
  const user = { id, ...body, createdAt: new Date().toISOString() };
  db.data.apiUsers[id] = user;
  await db.write();
  return reply.code(201).send({ user });
});

server.delete("/admin/api-users/:id", async (request, reply) => {
  if (!assertAdminKey(request, reply)) return;
  const { id } = idParamSchema.parse(request.params);
  await db.read();
  if (!db.data.apiUsers[id]) return reply.code(404).send({ error: "api_user_not_found" });
  delete db.data.apiUsers[id];
  await db.write();
  return reply.code(204).send();
});

// Event catalog docs (shape based on event.json)
server.get("/admin/event-docs", async (request, reply) => {
  if (!assertAdminKey(request, reply)) return;
  await db.read();
  const docs = Object.values(db.data.eventDocs).map((d) => ({
    id: d.id,
    name: typeof d.name === "string" ? d.name : "",
    type: typeof d.type === "string" ? d.type : "",
  }));
  return reply.code(200).send({ docs });
});

server.get("/admin/event-docs/:id", async (request, reply) => {
  if (!assertAdminKey(request, reply)) return;
  const { id } = idParamSchema.parse(request.params);
  await db.read();
  const doc = db.data.eventDocs[id];
  if (!doc) return reply.code(404).send({ error: "event_doc_not_found" });
  return reply.code(200).send({ doc });
});

server.post("/admin/event-docs/upsert", async (request, reply) => {
  if (!assertAdminKey(request, reply)) return;
  const body = z.object({ raw: z.string().min(1) }).parse(request.body);
  const parsed = parseLenientJson(body.raw);
  const doc = eventCatalogDocSchema.parse(parsed);

  await db.read();
  db.data.eventDocs[doc.id] = doc;
  await db.write();
  return reply.code(200).send({ ok: true, id: doc.id });
});

server.get("/admin/venues", async (request, reply) => {
  if (!assertAdminKey(request, reply)) return;
  await db.read();
  const venues = Object.values(db.data.venues).map((v) => ({
    id: v.id,
    name: typeof v.name === "string" ? v.name : "",
    type: typeof v.type === "string" ? v.type : "",
  }));
  return reply.code(200).send({ venues });
});

server.get("/admin/venues/:id", async (request, reply) => {
  if (!assertAdminKey(request, reply)) return;
  const { id } = idParamSchema.parse(request.params);
  await db.read();
  const doc = db.data.venues[id];
  if (!doc) return reply.code(404).send({ error: "venue_not_found" });
  return reply.code(200).send({ venue: doc });
});

server.post("/admin/venues/upsert", async (request, reply) => {
  if (!assertAdminKey(request, reply)) return;
  const body = z.object({ raw: z.string().min(1) }).parse(request.body);
  const parsed = parseLenientJson(body.raw);
  const doc = venueDocSchema.parse(parsed);

  await db.read();
  db.data.venues[doc.id] = doc as VenueDoc;
  await db.write();
  return reply.code(200).send({ ok: true, id: doc.id });
});

server.get("/admin/events", async (request, reply) => {
  if (!assertAdminKey(request, reply)) return;
  const q = adminEventsQuerySchema.parse(request.query);
  const venueFilter = q.venueId?.trim();
  await db.read();
  let rows = Object.values(db.data.events);
  if (venueFilter) {
    rows = rows.filter((d) => d.event?.venueId === venueFilter);
  }
  const events = rows.map((d) => ({
    eventId: d.event?.id,
    universalId: d.event?.universalId,
    venueId: d.event?.venueId,
    ticketsCount: Array.isArray(d.event?.tickets) ? d.event.tickets.length : 0,
  }));
  return reply.code(200).send({ events });
});

server.get("/admin/events/:id", async (request, reply) => {
  if (!assertAdminKey(request, reply)) return;
  const { id } = idParamSchema.parse(request.params);
  await db.read();
  const doc = db.data.events[id];
  if (!doc) return reply.code(404).send({ error: "event_not_found" });
  return reply.code(200).send({ event: doc });
});

server.post("/admin/events/upsert", async (request, reply) => {
  if (!assertAdminKey(request, reply)) return;

  const body = z.object({
    raw: z.string().min(1),
  }).parse(request.body);

  const parsed = parseLenientJson(body.raw);
  const doc = availabilityDocSchema.parse(parsed);

  await db.read();
  db.data.events[doc.event.id] = doc;
  await db.write();

  return reply.code(200).send({ ok: true, eventId: doc.event.id });
});

// Serve React UI (built assets) from same port.
// IMPORTANT: register AFTER API routes so `/admin/*` and `/partners/*` win.
const uiDistDir = path.resolve(process.cwd(), "ui", "dist");
if (fs.existsSync(uiDistDir)) {
  await server.register(fastifyStatic, {
    root: uiDistDir,
    prefix: "/",
  });

  // SPA fallback: if no route matched, return index.html (but never for API paths).
  server.setNotFoundHandler(async (request, reply) => {
    const url = request.raw.url || "/";
    if (
      url.startsWith("/admin") ||
      url.startsWith("/partners") ||
      url.startsWith("/discovery") ||
      url.startsWith("/health") ||
      url.startsWith("/venues.json")
    ) {
      return reply.code(404).send({ error: "not_found" });
    }
    if (request.method !== "GET") {
      return reply.code(404).send({ error: "not_found" });
    }
    return reply.sendFile("index.html");
  });
}

await server.listen({ port: PORT, host: "127.0.0.1" });

