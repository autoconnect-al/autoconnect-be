import { Search } from '../types/Search';

export interface SearchListDto {
  id: string;
  make: string;
  model: string;
  variant?: string | null;
  registration?: string | null;
  price?: string | null;
  transmission?: string | null;
  fuelType?: string | null;
  mileage?: string | null;
  customsPaid?: boolean | null;
  canExchange?: boolean;
  sidecarMedias?: string | null; // JSON string for frontend
  contact?: string | null;
  minPrice?: string | null;
  maxPrice?: string | null;
  promoted?: boolean;
  highlighted?: boolean;

  vendorContact?: string | null;
  biography?: string | null;
  accountName?: string | null;
  vendorId?: string | null;
  profilePicture?: string | null;
  type?: string | null;
}

/* =========================================================
   Helper function: map from full Search to SearchListDto
========================================================= */
export function mapSearchToListDto(
  result: Search,
  maxSidecarItems: number = 4,
): SearchListDto {
  // Parse sidecar medias
  let sidecarMedias: string | null = null;
  if (result.sidecarMedias) {
    try {
      const medias = JSON.parse(result.sidecarMedias as unknown as string) as {
        imageThumbnailUrl: string;
      }[];
      const sliced = medias.slice(0, maxSidecarItems);
      sidecarMedias = JSON.stringify(
        sliced.map((m) => ({ imageThumbnailUrl: m.imageThumbnailUrl })),
      );
    } catch {
      sidecarMedias = null;
    }
  }

  const promoted = !!(result.promotionTo || result.highlightedTo); // example logic

  return {
    id: result.id.toString(),
    make: result.make || '',
    model: result.model || '',
    variant: result.variant || null,
    registration: result.registration?.toString() || null,
    price: result.price?.toString() || null,
    transmission: result.transmission || null,
    fuelType: result.fuelType || null,
    mileage: result.mileage?.toString() || null,
    customsPaid: result.customsPaid ?? null,
    canExchange: result.canExchange ?? false,
    sidecarMedias,
    contact: result.contact ? JSON.stringify(result.contact) : null,
    minPrice: promoted ? null : result.minPrice?.toString() || null,
    maxPrice: promoted ? null : result.maxPrice?.toString() || null,
    promoted,
    highlighted: !!result.highlightedTo,

    vendorContact: result.vendorContact
      ? JSON.stringify(result.vendorContact)
      : null,
    biography: result.biography || null,
    accountName: result.accountName || null,
    vendorId: result.vendorId?.toString() || null,
    profilePicture: result.profilePicture || null,
    type: result.type || null,
  };
}
