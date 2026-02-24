import type { PostModel } from '../types/instagram';

const mercedesModelsToFix = [
  'A-Class',
  'B-Class',
  'C-Class',
  'E-Class',
  'G-Class',
  'S-Class',
  'V-Class',
];

export function mapMake(make?: string): string {
  if (!make) return '';
  if (make === 'Renault Samsung') {
    return 'Renault';
  }
  if (make === 'GM Korea') {
    return 'Chevrolet';
  }
  return make;
}

export function mapBodyType(bodyType?: string): string {
  const bodyTypeMap: Record<string, string> = {
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
  return bodyType ? bodyTypeMap[bodyType.toLowerCase()] || '' : '';
}

export function mapVariant(variant?: string, model?: string): string {
  if (!variant) {
    return '';
  }

  const safeModel = model ?? '';
  let lowerVariant = variant.toLowerCase();
  if (safeModel && lowerVariant.includes(safeModel.toLowerCase())) {
    if (safeModel.length > 3) {
      lowerVariant = lowerVariant.replaceAll(safeModel.toLowerCase(), '').trim();
      if (mercedesModelsToFix.includes(safeModel)) {
        const beginning = safeModel.charAt(0).toLowerCase();
        const modelRegex = new RegExp(`\\b${beginning}\\d+(?=[A-Za-z]|\\b)`, 'gi');
        const foundModelItem = lowerVariant.match(modelRegex);
        if (foundModelItem) {
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
        .replaceAll(safeModel.toLowerCase() + '-class', '')
        .trim();
      if (lowerVariant.startsWith(safeModel.toLowerCase())) {
        lowerVariant = lowerVariant.replace(safeModel.toLowerCase(), '').trim();
      }
      const modelWithoutClass = safeModel.toLowerCase().replaceAll('-class', '');
      const regex = new RegExp(`\\b${modelWithoutClass}\\d+(?=[A-Za-z]|\\b)`, 'gi');
      const foundItem = lowerVariant.match(regex);
      if (foundItem) {
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

      if (mercedesModelsToFix.includes(safeModel)) {
        const beginning = safeModel.charAt(0).toLowerCase();
        const modelRegex = new RegExp(`\\b${beginning}\\d+(?=[A-Za-z]|\\b)`, 'gi');
        const foundModelItem = lowerVariant.match(modelRegex);
        if (foundModelItem) {
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
    .replaceAll('the next ', '')
    .replaceAll('the master ', '')
    .replaceAll('all new ', '')
    .replaceAll('new ', '')
    .replaceAll('gasoline ', '')
    .replaceAll('diesel ', '')
    .replaceAll('(js)', '')
    .replaceAll('(ja)', '')
    .replaceAll('(jl)', '')
    .replaceAll('(kl)', '')
    .replaceAll('(rent -a -car)', '')
    .replaceAll('lg', '')
    .replaceAll('1st generation', '')
    .replaceAll('2nd generation', '')
    .replaceAll('3rd generation', '')
    .replaceAll('4th generation', '')
    .replaceAll('5th generation', '')
    .replaceAll('6th generation', '')
    .replaceAll('7th generation', '')
    .replaceAll('8th generation', '')
    .replaceAll('9th generation', '')
    .replaceAll('10th generation', '')
    .replaceAll('1 st generation', '')
    .replaceAll('2 nd generation', '')
    .replaceAll('3 rd generation', '')
    .replaceAll('4 th generation', '')
    .replaceAll('5 th generation', '')
    .replaceAll('6 th generation', '')
    .replaceAll('7 th generation', '')
    .replaceAll('8 th generation', '')
    .replaceAll('9 th generation', '')
    .replaceAll('10 th generation', '')
    .replaceAll(' -seater', '-seater')
    .replaceAll('taxi type', '')
    .replaceAll('Amg', 'AMG')
    .replaceAll('amg', ' AMG')
    .replaceAll('range rover', '')
    .replaceAll(/\s\s+/g, ' ');

  lowerVariant = lowerVariant
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return lowerVariant.trim();
}

export function mapModel(model?: string, make?: string): string {
  if (!model) return '';
  const safeMake = make ?? '';

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
    safeMake.toLowerCase() === 'land rover' &&
    lowerModel.includes('range rover')
  ) {
    lowerModel = lowerModel.replace('range rover', '').trim();
  }
  if (safeMake && lowerModel.includes(safeMake.toLowerCase())) {
    lowerModel = lowerModel
      .replaceAll(safeMake.toLowerCase(), '')
      .replaceAll(/\s\s+/g, ' ')
      .trim();
  }
  lowerModel = lowerModel
    .replaceAll('-klasse', '-class')
    .replaceAll(/\s\s+/g, ' ');

  if (safeMake.toLowerCase() === 'mercedes-benz') {
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
  if (safeMake === 'Lexus' && lowerModel.length < 3) {
    lowerModel = lowerModel.toUpperCase() + ' Series';
  }
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

export function mapFuelType(fuel?: string): string {
  if (!fuel) return '';
  const fuelTypeMap: Record<string, string> = {
    gasoline: 'Petrol',
    diesel: 'Diesel',
    hybrid: 'Hybrid',
    electric: 'Electric',
    lpg: 'gas',
    cng: 'gas',
    other: '',
  };
  return fuelTypeMap[fuel.toLowerCase()] || '';
}

export function mapDrivetrain(drivetrain?: string): string {
  if (!drivetrain) return '';
  const drivetrainMap: Record<string, string> = {
    front: 'FWD',
    rear: 'RWD',
    all: 'AWD',
    four: '4WD',
    unknown: '',
    other: '',
  };
  return drivetrainMap[drivetrain.toLowerCase()] || '';
}

export function calculatePrice(carPrice?: number, bodyType?: string): number | undefined {
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
    const fees = 400;
    const revenue = 250;
    const shippingFee = ['SUV/Off-Road/Pick-up', 'transporter'].some(
      (value) => value.toLowerCase() === bodyType?.toLowerCase(),
    )
      ? 1700
      : 1500;
    const totalPrice = parsePrice + fees + revenue + shippingFee;
    return Math.round(totalPrice);
  } catch {
    return undefined;
  }
}

export function buildEncarCaption(postData: PostModel): string {
  return (
    `${postData.cardDetails.make} ${postData.cardDetails.model} ${postData.cardDetails.variant}\n` +
    `Year: ${postData.cardDetails.registration}\n` +
    `Mileage: ${postData.cardDetails.mileage} km\n` +
    `Transmission: ${postData.cardDetails.transmission}\n` +
    `Body Type: ${postData.cardDetails.bodyType}\n` +
    `Fuel Type: ${postData.cardDetails.fuelType}\n` +
    `Engine: ${postData.cardDetails.engine} L\n` +
    `Price: ${postData.cardDetails.price ? postData.cardDetails.price + ' EUR (Deri ne Durres, Pa dogane)' : 'Contact us for price'}\n` +
    `VIN: ${postData.cardDetails.vin}\n`
  );
}
