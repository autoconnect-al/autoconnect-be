/**
 * Represents a row in the bulk import CSV
 * Combines data from post and car_detail tables
 */
export interface BulkImportRow {
  // Post fields
  post_id: string;
  post_origin: string | null;
  post_revalidate: boolean | null;
  post_dateCreated: Date | string;
  post_caption: string | null;
  post_cleanedCaption: string | null;
  post_vendor_id: string;
  post_car_detail_id: string | null;
  post_status: string | null;

  // Car detail fields
  cd_id: string | null;
  cd_published: boolean | null;
  cd_sold: boolean | null;
  cd_deleted: boolean | null;
  cd_make: string | null;
  cd_model: string | null;
  cd_variant: string | null;
  cd_registration: string | null;
  cd_mileage: number | null;
  cd_transmission: string | null;
  cd_fuelType: string | null;
  cd_engineSize: string | null;
  cd_drivetrain: string | null;
  cd_seats: number | null;
  cd_numberOfDoors: number | null;
  cd_bodyType: string | null;
  cd_customsPaid: boolean | null;
  cd_options: string | null;
  cd_price: number | null;
  cd_emissionGroup: string | null;
  cd_type: string | null;
  cd_contact: string | null;
  cd_priceVerified: boolean | null;
  cd_mileageVerified: boolean | null;
  cd_country: string | null;
  cd_city: string | null;
  cd_countryOfOriginForVehicles: string | null;
  cd_phoneNumber: string | null;
  cd_whatsAppNumber: string | null;
  cd_location: string | null;
}

/**
 * Raw query result from the database
 */
export interface BulkImportQueryResult {
  id: bigint;
  origin: string | null;
  revalidate: boolean | null;
  dateCreated: Date;
  car_detail_id: bigint | null;
  caption: string | null;
  cleanedCaption: string | null;
  vendor_id: bigint;
  status: string | null;

  cd_id: bigint | null;
  cd_published: boolean | null;
  cd_sold: boolean | null;
  cd_deleted: boolean | null;
  cd_make: string | null;
  cd_model: string | null;
  cd_variant: string | null;
  cd_registration: string | null;
  cd_mileage: number | null;
  cd_transmission: string | null;
  cd_fuelType: string | null;
  cd_engineSize: string | null;
  cd_drivetrain: string | null;
  cd_seats: number | null;
  cd_numberOfDoors: number | null;
  cd_bodyType: string | null;
  cd_customsPaid: boolean | null;
  cd_options: string | null;
  cd_price: number | null;
  cd_emissionGroup: string | null;
  cd_type: string | null;
  cd_contact: string | null;
  cd_priceVerified: boolean | null;
  cd_mileageVerified: boolean | null;
  cd_country: string | null;
  cd_city: string | null;
  cd_countryOfOriginForVehicles: string | null;
  cd_phoneNumber: string | null;
  cd_whatsAppNumber: string | null;
  cd_location: string | null;

  grp1_pub_or_revalidate: number;
  grp2_not_sold: number;
  grp3_not_deleted: number;
  grp4_origin_ok: number;
  matches_query: number;
  car_detail_missing: number;
}
