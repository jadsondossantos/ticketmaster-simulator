import { JSONFilePreset } from "lowdb/node";
import type { Low } from "lowdb";

export type AvailabilityDoc = {
  event: {
    id: string;
    universalId?: string;
    restrictSingle?: boolean;
    safeTixEnabled?: boolean;
    eventTicketLimit?: number;
    onsale?: string;
    offsale?: string;
    eventDateTime?: string;
    granularPricing?: boolean;
    allInclusivePricing?: boolean;
    tickets?: unknown[];
    seatLocationMapRestrict?: boolean;
    locXnumAddescRestrict?: boolean;
    locRowSeatRestrict?: boolean;
    serviceFeeRollup?: boolean;
    facilityFeeRollup?: boolean;
    venueId?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
};

export type ApiUserDoc = {
  id: string;
  name: string;
  email: string;
  token: string;
  createdAt: string;
};

export type EventCatalogDoc = {
  id: string;
  name?: string | undefined;
  type?: string | undefined;
  [k: string]: unknown;
};

/** Discovery API–style venue document (see Ticketmaster venue JSON). */
export type VenueDoc = {
  id: string;
  name?: string;
  type?: string;
  test?: boolean;
  url?: string;
  locale?: string;
  postalCode?: string;
  timezone?: string;
  city?: { name?: string; [k: string]: unknown };
  state?: { name?: string; stateCode?: string; [k: string]: unknown };
  country?: { name?: string; countryCode?: string; [k: string]: unknown };
  address?: { line1?: string; [k: string]: unknown };
  location?: { longitude?: string; latitude?: string; [k: string]: unknown };
  markets?: Array<{ name?: string; id?: string; [k: string]: unknown }>;
  dmas?: Array<{ id?: number; [k: string]: unknown }>;
  boxOfficeInfo?: {
    phoneNumberDetail?: string;
    openHoursDetail?: string;
    willCallDetail?: string;
    [k: string]: unknown;
  };
  parkingDetail?: string;
  generalInfo?: { generalRule?: string; [k: string]: unknown };
  upcomingEvents?: {
    tmr?: number;
    ticketmaster?: number;
    _total?: number;
    _filtered?: number;
    [k: string]: unknown;
  };
  _links?: unknown;
  [k: string]: unknown;
};

export type DocDbData = {
  events: Record<string, AvailabilityDoc>;
  apiUsers: Record<string, ApiUserDoc>;
  eventDocs: Record<string, EventCatalogDoc>;
  venues: Record<string, VenueDoc>;
};

export async function openDb(): Promise<Low<DocDbData>> {
  // Stored in-repo for local development.
  const db = await JSONFilePreset<DocDbData>("docdb.json", {
    events: {},
    apiUsers: {},
    eventDocs: {},
    venues: {},
  });
  await db.read();
  // Backward-compatible defaults if docdb.json existed before new keys.
  db.data.events ??= {};
  db.data.apiUsers ??= {};
  db.data.eventDocs ??= {};
  db.data.venues ??= {};
  await db.write();
  return db;
}

