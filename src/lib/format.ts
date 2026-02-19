import type { Money, OpenHouse, PropertyAddress } from "@/lib/types";

export function formatMoney(m: Money) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: m.currency,
    maximumFractionDigits: 0
  }).format(m.amount);
}

export function formatAddressLine(a: PropertyAddress) {
  return `${a.street}, ${a.city}, ${a.state} ${a.zip}`;
}

export function formatOpenHouse(oh: OpenHouse) {
  const start = new Date(oh.startIso);
  const end = oh.endIso ? new Date(oh.endIso) : null;

  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "America/New_York"
  }).format(start);

  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York"
  }).format(start);

  const endTime =
    end &&
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York"
    }).format(end);

  return endTime ? `${date} · ${time}–${endTime}` : `${date} · ${time}`;
}

