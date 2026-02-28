import {
  buildEncarCaption,
  calculatePrice,
  mapBodyType,
  mapDrivetrain,
  mapFuelType,
  mapMake,
  mapModel,
  mapVariant,
} from './encar-mapper.util';
import { PostModel } from '../types/instagram';

describe('encar-mapper.util', () => {
  it('maps make aliases', () => {
    expect(mapMake('Renault Samsung')).toBe('Renault');
    expect(mapMake('GM Korea')).toBe('Chevrolet');
    expect(mapMake('BMW')).toBe('BMW');
    expect(mapMake(undefined)).toBe('');
  });

  it('maps body type values', () => {
    expect(mapBodyType('suv')).toBe('SUV/Off-Road/Pick-up');
    expect(mapBodyType('minivan')).toBe('Van');
    expect(mapBodyType('other')).toBe('');
    expect(mapBodyType(undefined)).toBe('');
  });

  it('maps fuel and drivetrain values', () => {
    expect(mapFuelType('gasoline')).toBe('Petrol');
    expect(mapFuelType('lpg')).toBe('gas');
    expect(mapFuelType('unknown')).toBe('');
    expect(mapDrivetrain('front')).toBe('FWD');
    expect(mapDrivetrain('all')).toBe('AWD');
    expect(mapDrivetrain('unknown')).toBe('');
  });

  it('maps models with make-specific normalization', () => {
    expect(mapModel('c-klasse', 'Mercedes-Benz')).toBe('C-Class');
    expect(mapModel('1er', 'BMW')).toBe('1 Series');
    expect(mapModel('911', 'Porsche')).toBe('911 Series');
  });

  it('maps variants and removes noisy prefixes', () => {
    expect(mapVariant('The New C-Class AMG', 'C-Class')).toBe('AMG');
    expect(mapVariant('', 'C-Class')).toBe('');
    expect(mapVariant('The New AMG', undefined)).toBe('AMG');
  });

  it('calculates price with body-type shipping differences', () => {
    expect(calculatePrice(10000, 'SUV/Off-Road/Pick-up')).toBe(12350);
    expect(calculatePrice(10000, 'Sedan')).toBe(12150);
    expect(calculatePrice(undefined, 'Sedan')).toBeUndefined();
  });

  it('builds ENCAR caption from mapped post details', () => {
    const post = JSON.parse(JSON.stringify(PostModel)) as PostModel;
    post.cardDetails.make = 'BMW';
    post.cardDetails.model = 'X5';
    post.cardDetails.variant = 'M Package';
    post.cardDetails.registration = 2020;
    post.cardDetails.mileage = 120000;
    post.cardDetails.transmission = 'Automatic';
    post.cardDetails.bodyType = 'SUV/Off-Road/Pick-up';
    post.cardDetails.fuelType = 'Diesel';
    post.cardDetails.engine = 3;
    post.cardDetails.price = 24500;
    post.cardDetails.vin = 'VIN123';

    const caption = buildEncarCaption(post);

    expect(caption).toContain('BMW X5 M Package');
    expect(caption).toContain('Year: 2020');
    expect(caption).toContain('Price: 24500 EUR (Deri ne Durres, Pa dogane)');
    expect(caption).toContain('VIN: VIN123');
  });
});
