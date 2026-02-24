import { IdriveScrapeResponse, Vehicle } from '../types/encar';
import { PostModel } from '../types/instagram';
import { createLogger } from '../../../common/logger.util';
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

const url = `https://triovetura.com/api/proxy?endpoint=cars&filters=buy_now_price_from%3D1000%26per_page%3D50%26buy_now%3D1%26status%3D3%26from_year%3D2000%26sortDirection%3Ddesc%26page%3D{page}%26vehicle_type%3D1`;
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

        postData.caption = buildEncarCaption(postData);

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
