export type Money = {
  amount: number;
  currency: "USD";
};

export type PropertyAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

export type PropertyAgent = {
  name: string;
  phone?: string;
  email?: string;
  brokerage?: string;
  photoUrl?: string;
};

export type OpenHouse = {
  startIso: string;
  endIso?: string;
  note?: string;
};

export type PropertyLocation = {
  lat: number;
  lon: number;
};

export type PropertyMedia = {
  hero?: string[];
  photos?: string[];
  floorplans?: string[];
  documents?: { label: string; href: string }[];
  video?: {
    title?: string;
    embedUrl?: string;
    mp4Url?: string;
    posterUrl?: string;
  };
  tours?: { label: string; href: string }[];
};

export type Property = {
  slug: string;
  address: PropertyAddress;
  price: Money;
  beds: number;
  baths: number;
  homeSqft: number;
  lot: { acres?: number; sqft?: number };
  headline?: string;
  description: string;
  features?: string[];
  agent?: PropertyAgent;
  openHouses?: OpenHouse[];
  location?: PropertyLocation;
  media?: PropertyMedia;
};

export type PropertyFront = Pick<
  Property,
  "slug" | "address" | "price" | "beds" | "baths" | "homeSqft" | "headline"
> & {
  heroImage?: string;
};
