import { BaseProvider } from 'providers/base.ts'
import { hudClient } from 'utils/api/hud.ts'
import { createPropertyMeta, getLookupData } from 'utils/db.ts'

const lookupKeys = {
  default: 'One-Bedroom',
  1: 'One-Bedroom',
  2: 'Two-Bedroom',
  3: 'Three-Bedroom',
  4: 'Four-Bedroom'
};


export class FmrProvider extends BaseProvider {
  getData = async () => {
    const { property } = this.model

    const lookupDetails = await getLookupData(property.id, 'address_lookup')

    const { state, county, zipCode, bedrooms } = lookupDetails

    const { data: counties } = await hudClient.get(`listCounties/${state}`)

    const lookupCounty = counties.find(row => row.county_name === county || row.county_name.includes(county))

    if (lookupCounty) {
      const { fips_code } = lookupCounty

      const { data: fmrResult } = await hudClient.get(`data/${fips_code}?year=2025`)

      const [zipCodeMatch] = fmrResult.data.basicdata.filter(row => row.zip_code === zipCode)

      if (zipCodeMatch) {
        const lookupKey = lookupKeys[bedrooms] || lookupKeys.default;

        const fmrValue = zipCodeMatch[lookupKey];

        await createPropertyMeta(property.id, 'fmr', fmrValue);
      }
    }
  }
}
