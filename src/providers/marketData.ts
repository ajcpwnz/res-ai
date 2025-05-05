import { BaseProvider } from 'providers/base';
import { rentcastClient } from 'utils/api/rentcast.ts'
import { createPropertyMeta, saveLookupResult } from 'utils/db.ts'

export class MarketDataProvider extends BaseProvider {
  getData = async () => {
    const { property } = this.model;
    const { meta } = property;
    const address = property.address.fullAddress


    const { data } = await rentcastClient.get('/avm/rent/long-term', {
      params: {
        address,
        propertyType: meta.property_type,
        bedrooms: meta.bedrooms,
        bathrooms: meta.bathrooms,
        squareFootage: meta.square_footage
      }
    });


    const metas: Record<string, any> = {
      avg_rent: data.rent,
      rent_low: data.rentRangeLow,
      rent_high: data.rentRangeHigh,
    }

    for (const [key, value] of Object.entries(metas)) {
      if (!value) continue;

      await createPropertyMeta(property.id, key, value)
    }

    for (const rentComp of Object.values(data.comparables?.slice(0, 5))) {
      await saveLookupResult(property.id, 'rent_comp', rentComp, address);
    }


  }
}
