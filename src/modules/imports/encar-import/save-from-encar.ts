import { IdriveScrapeResponse, Vehicle } from '../types/encar';
import { PostModel } from '../types/instagram';
import { createLogger } from '../../../common/logger.util';

const url = `https://triovetura.com/api/proxy?endpoint=cars&filters=buy_now_price_from%3D1000%26per_page%3D50%26buy_now%3D1%26status%3D3%26from_year%3D2000%26sortDirection%3Ddesc%26page%3D{page}%26vehicle_type%3D1`;
const mercedesModelsToFix = [
  'A-Class',
  'B-Class',
  'C-Class',
  'E-Class',
  'G-Class',
  'S-Class',
  'V-Class',
];
const logger = createLogger('encar-save');

export async function scrapeEncar(
  page?: number,
): Promise<IdriveScrapeResponse> {
  if (!page) {
    page = 1;
  }
  const requests = [] as any[];

  try {
    const constructedUrl = url.replace('{page}', page.toString());
    const response = await fetch(constructedUrl);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const encodedResponse = await response.json();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access
    const base64Data = encodedResponse.d;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    const decodedData = Buffer.from(base64Data, 'base64').toString('utf-8');
    const parsedData = JSON.parse(decodedData) as {
      data: Vehicle[];
      total_count: number;
    };

    for (const vehicle of parsedData.data) {
      const price =
        vehicle.lots && vehicle.lots.length > 0
          ? vehicle.lots[0].buy_now
          : null;
      const images: string[] | undefined = vehicle.lots[0]?.images?.big;
      if (price && images?.length > 5) {
        const postData = JSON.parse(JSON.stringify(PostModel)) as PostModel;
        postData.id = vehicle.lots[0].lot;

        postData.cardDetails.make = mapMake(vehicle.manufacturer.name);

        postData.cardDetails.model = mapModel(
          vehicle.model.name,
          postData.cardDetails.make,
        );

        postData.cardDetails.variant = mapVariant(
          vehicle.title,
          postData.cardDetails?.model,
        );
        logger.info('variant mapped', {
          title: vehicle.title,
          variant: postData.cardDetails.variant,
        });
        postData.cardDetails.registration = vehicle.year;
        postData.cardDetails.mileage = vehicle.lots[0]?.odometer?.km;
        postData.cardDetails.transmission = vehicle.transmission?.name;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        postData.cardDetails.bodyType = mapBodyType(vehicle.body_type?.name);
        postData.cardDetails.price =
          calculatePrice(price, postData.cardDetails.bodyType) ?? 0;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        postData.cardDetails.drivetrain = mapDrivetrain(
          vehicle.drive_wheel?.name,
        );
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        postData.cardDetails.fuelType = mapFuelType(vehicle.fuel?.name);

        const engine = vehicle.lots[0]?.details.engine_volume / 1000;
        postData.cardDetails.engine = Math.ceil(engine * 10) / 10; // round to 1 decimal place
        postData.cardDetails.vin = vehicle.vin;

        postData.type = 'sidecar';
        postData.createdTime = (new Date().getTime() / 1000).toString();

        postData.origin = 'ENCAR';
        postData.sidecarMedias = images?.map((image: string, index: number) => {
          return {
            id: `${postData.id}-${(index + 1).toString().padStart(2, '0')}`,
            imageStandardResolutionUrl: image,
            type: 'image',
          };
        });
        postData.cardDetails.contact = {
          phone_number: '+355697233372',
          whatsapp: '+355697233372',
          address: ['Korea', vehicle.lots[0]?.location?.city?.name]
            .filter((el) => !!el)
            .join(', '),
        };

        postData.caption =
          `${postData.cardDetails.make} ${postData.cardDetails.model} ${postData.cardDetails.variant}\n` +
          `Year: ${postData.cardDetails.registration}\n` +
          `Mileage: ${postData.cardDetails.mileage} km\n` +
          `Transmission: ${postData.cardDetails.transmission}\n` +
          `Body Type: ${postData.cardDetails.bodyType}\n` +
          `Fuel Type: ${postData.cardDetails.fuelType}\n` +
          `Engine: ${postData.cardDetails.engine} L\n` +
          `Price: ${calculatePrice(price, postData.cardDetails.bodyType) ? calculatePrice(price, postData.cardDetails.bodyType) + ' EUR (Deri ne Durres, Pa dogane)' : 'Contact us for price'}\n` +
          `VIN: ${postData.cardDetails.vin}\n`;

        requests.push(postData);
      }
    }
  } catch (e) {
    logger.error('Error scraping Encar', {
      error: e instanceof Error ? e.message : String(e),
    });
    return {
      carsToSave: [] as any[],
      hasMore: false,
      page: page,
    };
  }
  return {
    carsToSave: requests,
    hasMore: requests.length > 0,
    page: page + 1,
  } as IdriveScrapeResponse;
}

function mapMake(make: string) {
  if (!make) return '';
  if (make === 'Renault Samsung') {
    return 'Renault';
  }
  if (make === 'GM Korea') {
    return 'Chevrolet';
  }
  return make;
}

function mapBodyType(bodyType: string) {
  const bodyTypeMap = {
    sedan: 'Sedan',
    suv: 'SUV/Off-Road/Pick-up',
    pickup: 'SUV/Off-Road/Pick-up',
    hatchback: 'compact',
    coupe: 'Coupe',
    convertible: 'Convertible',
    wagon: 'Station Wagon',
    van: 'Van',
    transporter: 'transporter',
    unknown: '',
    other: '',
    minivan: 'Van',
  };
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return bodyType ? bodyTypeMap[bodyType.toLowerCase()] || '' : '';
}

function mapVariant(variant: string, model: string) {
  if (!variant) {
    return '';
  }

  let lowerVariant = variant.toLowerCase();
  if (lowerVariant.includes(model.toLowerCase())) {
    if (model.length > 3) {
      lowerVariant = lowerVariant.replaceAll(model.toLowerCase(), '').trim();
      if (mercedesModelsToFix.includes(model)) {
        const beginning = model.charAt(0).toLowerCase();
        const modelRegex = new RegExp(
          `\\b${beginning}\\d+(?=[A-Za-z]|\\b)`,
          'gi',
        );
        const foundModelItem = lowerVariant.match(modelRegex);
        if (foundModelItem) {
          // split the found item from the variant in half and add a space
          const index =
            foundModelItem[0].length - foundModelItem[0].toString().length + 1;
          lowerVariant = lowerVariant
            .replace(
              foundModelItem[0],
              foundModelItem[0].toString().slice(0, index).toUpperCase() +
                ' ' +
                foundModelItem[0].toString().slice(index),
            )
            .trim();
        }
      }
    } else {
      lowerVariant = lowerVariant
        .replaceAll(model.toLowerCase() + '-class', '')
        .trim();
      if (lowerVariant.startsWith(model.toLowerCase())) {
        lowerVariant = lowerVariant.replace(model.toLowerCase(), '').trim();
      }
      const modelWithoutClass = model.toLowerCase().replaceAll('-class', '');
      const regex = new RegExp(
        `\\b${modelWithoutClass}\\d+(?=[A-Za-z]|\\b)`,
        'gi',
      );
      const foundItem = lowerVariant.match(regex);
      if (foundItem) {
        // split the found item from the variant in half and add a space
        const index = foundItem[0].length - foundItem[0].toString().length + 3;
        lowerVariant = lowerVariant
          .replace(
            foundItem[0],
            foundItem[0].toString().slice(0, index).toUpperCase() +
              ' ' +
              foundItem[0].toString().slice(index),
          )
          .trim();
      }

      if (mercedesModelsToFix.includes(model)) {
        const beginning = model.charAt(0).toLowerCase();
        const modelRegex = new RegExp(
          `\\b${beginning}\\d+(?=[A-Za-z]|\\b)`,
          'gi',
        );
        const foundModelItem = lowerVariant.match(modelRegex);
        if (foundModelItem) {
          // split the found item from the variant in half and add a space
          const index =
            foundModelItem[0].length - foundModelItem[0].toString().length + 1;
          lowerVariant = lowerVariant
            .replace(
              foundModelItem[0],
              foundModelItem[0].toString().slice(0, index).toUpperCase() +
                ' ' +
                foundModelItem[0].toString().slice(index),
            )
            .trim();
        }
      }
    }
  }
  lowerVariant = lowerVariant
    .replaceAll('the new ', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('the next ', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('the master ', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('all new ', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant.replaceAll('new ', '').replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('gasoline ', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('diesel ', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant.replaceAll('(js)', '').replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant.replaceAll('(ja)', '').replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant.replaceAll('(jl)', '').replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant.replaceAll('(kl)', '').replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('(rent -a -car)', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant.replaceAll('lg', '').replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('1st generation', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('2nd generation', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('3rd generation', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('4th generation', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('5th generation', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('6th generation', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('7th generation', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('8th generation', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('9th generation', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('10th generation', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('1 st generation', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('2 nd generation', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('3 rd generation', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('4 th generation', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('5 th generation', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('6 th generation', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('7 th generation', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('8 th generation', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('9 th generation', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('10 th generation', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll(' -seater', '-seater')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant
    .replaceAll('taxi type', '')
    .replaceAll(/\s\s+/g, ' ');
  lowerVariant = lowerVariant.replaceAll('Amg', 'AMG');
  lowerVariant = lowerVariant.replaceAll('amg', ' AMG');
  lowerVariant = lowerVariant.replaceAll('range rover', '');

  // remove double spaces
  lowerVariant = lowerVariant.replaceAll(/\s\s+/g, ' ');
  // capitalize the first letter of each word
  lowerVariant = lowerVariant
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return lowerVariant.trim();
}

function mapModel(model: string, make: string) {
  if (!model) return '';

  let lowerModel = model.toLowerCase();
  if (
    lowerModel === '1er' ||
    lowerModel === '2er' ||
    lowerModel === '3er' ||
    lowerModel === '4er' ||
    lowerModel === '5er' ||
    lowerModel === '6er' ||
    lowerModel === '7er' ||
    lowerModel === '8er'
  ) {
    lowerModel = model.replaceAll('er', ' Series');
  }
  if (lowerModel === '911') {
    lowerModel = '911 Series';
  }
  if (lowerModel === 'mohave (borrego)') {
    lowerModel = 'Mohave/Borrego';
  }
  if (
    make.toLowerCase() === 'land rover' &&
    lowerModel.includes('range rover')
  ) {
    make = 'Range Rover';
    lowerModel = lowerModel.replace('range rover', '').trim();
  }
  if (lowerModel.includes(make.toLowerCase())) {
    lowerModel = lowerModel
      .replaceAll(make.toLowerCase(), '')
      .replaceAll(/\s\s+/g, ' ')
      .trim();
  }
  lowerModel = lowerModel
    .replaceAll('-klasse', '-class')
    .replaceAll(/\s\s+/g, ' ');

  if (make.toLowerCase() === 'mercedes-benz') {
    const parts = lowerModel.split('-');
    if (parts.length > 1) {
      if (parts[0].length > 1) {
        lowerModel = parts[0].toUpperCase();
      } else {
        lowerModel =
          parts[0].toUpperCase() +
          '-' +
          parts[1].charAt(0).toUpperCase() +
          parts[1].slice(1);
      }
    }
  }
  if (lowerModel.length <= 4) {
    lowerModel = lowerModel.toUpperCase();
  }
  if (lowerModel === 'Amg Gt') {
    lowerModel = 'AMG GT';
  }
  if (make === 'Lexus' && lowerModel.length < 3) {
    lowerModel = lowerModel.toUpperCase() + ' Series';
  }
  // capitalize the first letter of each word
  lowerModel = lowerModel
    .split(' ')
    .map((word) => {
      if (word.length <= 3) {
        return word.toUpperCase();
      } else {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
    })
    .join(' ')
    .trim()
    .replaceAll(/\s\s+/g, ' ');

  if (lowerModel.includes('-class')) {
    lowerModel = lowerModel.replaceAll('-class', '-Class');
  }
  return lowerModel;
}

function mapFuelType(fuel: string) {
  if (!fuel) return '';
  const fuelTypeMap = {
    gasoline: 'Petrol',
    diesel: 'Diesel',
    hybrid: 'Hybrid',
    electric: 'Electric',
    lpg: 'gas',
    cng: 'gas',
    other: '',
  };
  if (fuelTypeMap[fuel.toLowerCase()]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return fuelTypeMap[fuel.toLowerCase()];
  } else {
    return '';
  }
}

function mapDrivetrain(drivetrain: string) {
  if (!drivetrain) return '';
  const drivetrainMap = {
    front: 'FWD',
    rear: 'RWD',
    all: 'AWD',
    four: '4WD',
    unknown: '',
    other: '',
  };
  if (drivetrainMap[drivetrain.toLowerCase()]) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return drivetrainMap[drivetrain.toLowerCase()];
  } else {
    return '';
  }
}

function calculatePrice(carPrice?: number, bodyType?: string) {
  if (!carPrice) {
    return undefined;
  }
  try {
    const parsePrice = parseFloat(
      carPrice.toString().replace(/[^0-9.-]+/g, ''),
    );
    if (isNaN(parsePrice)) {
      return undefined;
    }
    const realPrice = parsePrice; // Convert to USD
    const fees = 400;
    const revenue = 250;
    const shippingFee = ['SUV/Off-Road/Pick-up', 'transporter'].some(
      (value) => value.toLowerCase() === bodyType?.toLowerCase(),
    )
      ? 1700
      : 1500;
    const totalPrice = realPrice + fees + revenue + shippingFee;
    return Math.round(totalPrice);
  } catch (e: any) {
    return undefined;
  }
}
