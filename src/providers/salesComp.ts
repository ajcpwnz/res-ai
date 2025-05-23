import { BaseProvider } from 'providers/base'
import { rentcastClient } from 'utils/api/rentcast.ts'
import { createPropertyMeta, saveLookupResults } from 'utils/db.ts'

export class SalesCompProvider extends BaseProvider {
  getData = async () => {
    const { property } = this.model
    const { meta } = property

    const address = property.address.fullAddress

    const { data } = await rentcastClient.get('/avm/value', {
      params: {
        address,
        propertyType: meta.property_type,
        bedrooms: meta.bedrooms,
        bathrooms: meta.bathrooms,
        squareFootage: meta.square_footage
      }
    })

    const metas = {
      avm_value: data.price,
    }

    for (const [key, value] of Object.entries(metas)) {
      if (!value) continue

      await createPropertyMeta(property.id, key, value)
    }

  // ?.filter(row => row.bedrooms === meta.bedrooms)
    const filteredComps = data.comparables?.slice(0, 5) || []

    await saveLookupResults(property.id, 'sales_comp', filteredComps, address)

    return {
      avm: metas,
      comparables: Object.values(data.comparables?.slice(0, 5))
    }
  }
}
