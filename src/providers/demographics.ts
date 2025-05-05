import { BaseProvider } from 'providers/base'
import { censusClient } from 'utils/api/census.ts'
import { getLookupData } from 'utils/db.ts'

const fields = [
  'NAME',
  // 'B01003_001E',  // total population
  // 'B19013_001E',  // median household income
  'B02001_002E',  // white alone
  'B02001_003E',  // black alone
  // 'B25003_003E',  // renter-occupied units
  // 'B25003_001E'   // total housing units
];

export class DemographicsProvider extends BaseProvider{
  getData = async () => {
    const { property } = this.model

    const lookupDetails = await getLookupData(property.id, 'address_lookup')

    const { zipCode} = lookupDetails


    const result = await censusClient.get('/', {
      params: {
        get: fields.join(','),
        for: `zip code tabulation area:${zipCode}`,
        key: '49d40fb2a2f127f45070f8d7c2110fdceb87dbe6'
      }
    });

    console.warn('dsds', result)


  }
}
