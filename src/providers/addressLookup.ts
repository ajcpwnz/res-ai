import axios from 'axios'
import { BaseProvider } from 'providers/base'
import { rentcastClient } from 'utils/api/rentcast'
import { createPropertyMeta, saveLookupResult } from 'utils/db'
import type { AddressLookupResult } from '../../samples/addressLookup'

const geocodeClient = axios.create({
  baseURL: 'https://maps.googleapis.com/maps/api',
  headers: { 'Content-Type': 'application/json' },
});


export class AddressLookupProvider extends BaseProvider {
  private lookupAddress = async (address: string) => {
    const { data } = await geocodeClient.get('/geocode/json', {
      params: { address, key: process.env.GOOGLE_API_KEY }
    });

    if (data.status !== 'OK' || !data.results.length) {
      throw new Error(`Geocoding failed: ${data.status}`);
    }

    const result = data.results[0];
    const comps  = result.address_components;

    const getComp = (type: string) =>
      comps.find(c => c.types.includes(type));

    const stateComp = getComp('administrative_area_level_1');
    const state     = stateComp?.short_name || null;
    const zipComp   = getComp('postal_code');
    const zip       = zipComp?.long_name   || null;

    let countyComp = getComp('administrative_area_level_2');
    let county = countyComp?.long_name || null;
    if (!county) {
      const localityComp = getComp('locality');

      if (localityComp?.long_name) {
        county = localityComp.long_name;
      }
    }

    // lat / lng
    const { lat, lng } = result.geometry.location;

    return {
      state,
      county,
      zip,
      latitude:  lat,
      longitude: lng,
    };
  }

  getData = async () => {
    const { property } = this.model
    const { meta } = property;
    const address = property.address.fullAddress

    try {
      const { data: [data] } = await rentcastClient.get<AddressLookupResult[]>('/properties', {
        params: { address }
      })

      if (!data) {
        // TODO: ;
        throw new Error(`Empty Rentcast response`)
      }


      const assesment = Object.values(data.taxAssessments || {}).pop()
      const propertyTax = Object.values(data.propertyTaxes || {}).pop()
  console.warn('dsdsdsds', data)
      // console.warn('Valuation data', valuationData)
      const metas: Record<string, any> = {
        rentcast_property_type: data.propertyType,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        square_footage: data.squareFootage,
        lot_size_sqft: data.lotSize,
        year_built: data.yearBuilt,
        assessed_value: assesment?.value,
        annual_property_tax: propertyTax?.total,
        zip_code: data.zipCode,
        last_sold_date: data.lastSaleDate,
        last_sold_price: data.lastSalePrice,
        unit_count: data.features?.unitCount || meta.unit_count || 1,
      }

      for (const [key, value] of Object.entries(metas)) {
        if (!value) continue

        await createPropertyMeta(property.id, key, value)
      }

      await saveLookupResult(property.id, 'address_lookup', data, address);

      return {
        ...metas,
        units: property.units
      };
    } catch (e) {
      const lookupResult = await this.lookupAddress(address);

      await saveLookupResult(property.id, 'address_lookup', lookupResult, address);

      throw new Error(`Empty Rentcast response`)
    }
  }
}
