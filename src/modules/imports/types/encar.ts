export interface Vehicle {
  id: number;
  year: number;
  title: string;
  vin: string;
  manufacturer: Manufacturer;
  model: Model;
  generation: Generation;
  body_type: NamedEntity;
  color: NamedEntity;
  engine: Engine;
  transmission: NamedEntity;
  drive_wheel: NamedEntity;
  vehicle_type: NamedEntity;
  fuel: NamedEntity;
  cylinders: number;
  lots: Lot[];
}

export interface Manufacturer {
  id: number;
  name: string;
}

export interface Model {
  id: number;
  name: string;
  manufacturer_id: number;
}

export interface Generation {
  id: number;
  name: string;
  manufacturer_id: number;
  model_id: number;
}

export interface NamedEntity {
  id: number;
  name: string;
}

export interface Engine {
  id: number;
  name: string;
}

export interface Lot {
  id: number;
  lot: string;
  domain: NamedEntity;
  external_id: string | null;
  odometer: Odometer;
  estimate_repair_price: number | null;
  pre_accident_price: number | null;
  clean_wholesale_price: number | null;
  actual_cash_value: number | null;
  sale_date: string | null;
  sale_date_updated_at: string | null;
  bid: number | null;
  bid_updated_at: string | null;
  buy_now: number | null;
  buy_now_updated_at: string | null;
  final_bid: number | null;
  final_bid_updated_at: string | null;
  status: NamedEntity;
  seller: string | null;
  seller_type: string | null;
  title: string | null;
  detailed_title: string | null;
  damage: Damage;
  keys_available: boolean;
  airbags: any | null;
  condition: NamedEntity;
  grade_iaai: any | null;
  images: Images;
  location: Location;
  tags: any | null;
  line: any | null;
  selling_branch: any | null;
  created_at: string;
  updated_at: string;
  details: Details;
  is_timed_auction: boolean;
  seller_reserve: any | null;
  auction_type: any | null;
}

export interface Odometer {
  km: number;
  mi: number;
  status: NamedEntity;
}

export interface Damage {
  main: string | null;
  second: string | null;
}

export interface Images {
  id: number;
  small: string | null;
  normal: string[];
  big: string[];
  exterior: string | null;
  interior: string | null;
  video: string | null;
  video_youtube_id: string | null;
  external_panorama_url: string | null;
  downloaded: string[];
}

export interface Location {
  country: {
    iso: string;
    name: string;
  };
  state: string | null;
  city: {
    id: number;
    name: string;
  } | null;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  postal_code: string | null;
  is_offsite: boolean | null;
  raw: string | null;
  offsite: string | null;
}

export interface Details {
  inspect_outer: InspectOuter[];
  sell_type: string;
  engine_volume: number;
  original_price: number;
  is_leasing: boolean;
  year: number;
  month: number;
  first_registration: DatePart;
  inspect: Inspect;
  badge: string;
  comment: string;
  description_ko: string;
  description_en: string;
  insurance_v2: InsuranceV2;
  options: Options;
  equipment: any | null;
}

export interface InspectOuter {
  attributes: string[];
  statusTypes: StatusType[];
  type: {
    code: string;
    title: string;
  };
}

export interface StatusType {
  code: string;
  title: string;
}

export interface DatePart {
  year: number;
  month: number;
  day: number;
}

export interface Inspect {
  accident_summary: {
    accident: string;
    exterior1rank: string;
    exterior2rank: string;
    main_framework: string;
    simple_repair: string;
  };
  outer: Record<string, string[]>;
  inner: Record<string, string>;
}

export interface InsuranceV2 {
  accidentCnt: number;
  accidents: any[];
  business: number;
  carInfoChanges: {
    carNo: string;
    date: string;
  }[];
  carInfoUse1s: string[];
  carInfoUse2s: string[];
  carNoChangeCnt: number;
  displacement: number;
  firstDate: string;
  floodTotalLossCnt: number;
  fuel: string;
  government: number;
  loan: number;
  maker: string;
  myAccidentCnt: number;
  myAccidentCost: number;
  notJoinDate1: string;
  otherAccidentCnt: number;
  otherAccidentCost: number;
  ownerChangeCnt: number;
  ownerChanges: any[];
  regDate: string;
  robberCnt: number;
  totalLossCnt: number;
  year: number;
}

export interface Options {
  choice: string[];
  etc: string[];
  standard: string[];
  tuning: string[];
  type: string;
}

export interface IdriveScrapeResponse {
  carsToSave: any[];
  hasMore: boolean;
  page: number;
}
