export interface Contact {
  phone_number: string;
  whatsapp: string;
  address: string;
}

export interface CardDetails {
  make: string;
  model: string;
  registration: number;
  variant: string;
  mileage: number;
  transmission: string;
  bodyType: string;
  fuelType: string;
  engine: string | number;
  vin: string;
  contact: Contact;
  price: number;
  drivetrain: string;
}

export interface SidecarMedia {
  id: number | string;
  imageStandardResolutionUrl: string;
  type: 'image' | 'video';
}

export interface PostModel {
  id: number | string;
  type: 'sidecar' | 'single';
  createdTime: string;
  caption: string;
  sidecarMedias: SidecarMedia[];
  likesCount: number;
  commentsCount: number;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  origin: 'INSTAGRAM' | 'FACEBOOK' | 'TIKTOK' | string;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | string;
  cardDetails: CardDetails;
}

export const PostModel: PostModel = {
  id: 0,
  type: 'sidecar',
  createdTime: '',
  caption: '',
  sidecarMedias: [
    {
      id: 0,
      imageStandardResolutionUrl: '',
      type: 'image',
    },
  ],
  likesCount: 0,
  commentsCount: 0,
  origin: 'INSTAGRAM',
  status: 'DRAFT',
  cardDetails: {
    make: '',
    model: '',
    registration: 0,
    variant: '',
    mileage: 0,
    transmission: '',
    bodyType: '',
    fuelType: '',
    engine: '',
    price: 0,
    vin: '',
    drivetrain: '',
    contact: {
      phone_number: '',
      whatsapp: '',
      address: '',
    },
  },
};
