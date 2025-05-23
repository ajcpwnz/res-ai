import axios from 'axios'
import { BaseProvider } from 'providers/base'
import { rentcastClient } from 'utils/api/rentcast'
import { createPropertyMeta, saveLookupResult } from 'utils/db'
import type { AddressLookupResult } from '../../samples/addressLookup'


export class AddressLookupProvider extends BaseProvider {
  getData = async () => {
    const { property } = this.model
    const { meta } = property;
    const address = property.address.fullAddress

    try {
      const { data: [data] } = await rentcastClient.get<AddressLookupResult[]>('/properties', {
        params: { address }
      })

      if (!data) {
        throw new Error(`Empty Rentcast response`)
      }


      const assesment = Object.values(data.taxAssessments || {}).pop()
      const propertyTax = Object.values(data.propertyTaxes || {}).pop()

      // console.warn('Valuation data', valuationData)
      const metas: Record<string, any> = {
        property_type: data.propertyType,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        square_footage: data.squareFootage,
        lot_size_sqft: data.lotSize,
        year_built: data.yearBuilt,
        assessed_value: assesment?.value,
        annual_property_tax: propertyTax?.total,
        zip_code: data.zipCode,
        unit_count: data.features?.unitCount || meta.unit_count || 1,
      }

      for (const [key, value] of Object.entries(metas)) {
        if (!value) continue

        await createPropertyMeta(property.id, key, value)
      }

      await saveLookupResult(property.id, 'address_lookup', data, address);

      return metas;
    } catch (e) {
      throw new Error(`Empty Rentcast response`)
    }
  }
}
