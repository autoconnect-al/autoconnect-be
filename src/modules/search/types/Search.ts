export interface Search {
  id: bigint;
  dateCreated: Date;
  dateUpdated?: Date | null;
  deleted: string;
  caption?: string | null;
  cleanedCaption: string;
  createdTime?: bigint | null;
  sidecarMedias?: string | null; // JSON column
  likesCount?: number | null;
  viewsCount?: number | null;
  vendorContact?: string | null; // JSON column
  biography?: string | null;
  accountName?: string | null;
  vendorId: bigint;
  profilePicture?: string | null;
  make?: string | null;
  model?: string | null;
  variant?: string | null;
  registration?: number | null;
  mileage?: number | null;
  price?: number | null;
  transmission?: string | null;
  fuelType?: string | null;
  engineSize?: number | null; // Decimal in MariaDB, mapped to number
  drivetrain?: string | null;
  seats?: number | null;
  numberOfDoors?: number | null;
  bodyType?: string | null;
  emissionGroup?: string | null;
  contact?: string | null; // JSON column
  customsPaid?: boolean | null;
  options?: string | null; // JSON column
  sold?: boolean | null;
  type?: string | null;
  promotionTo?: number | null;
  highlightedTo?: number | null;
  renewTo?: number | null;
  renewInterval?: string | null;
  renewedTime?: number | null;
  mostWantedTo?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  canExchange?: boolean;
}
