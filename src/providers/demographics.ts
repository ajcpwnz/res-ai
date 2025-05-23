import { BaseProvider } from 'providers/base'
import { censusClient } from 'utils/api/census.ts'
import { getLookupData, saveLookupResult } from 'utils/db.ts'

enum CensusDataSet {
  totalPopulation = 'B01003_001E',
  whitePopulation = 'B02001_002E',
  latinoPopulation = 'B01001I_001E',
  blackPopulation = 'B02001_003E',
  renterUnits = 'B25003_003E',
  housingUnits = 'B25003_001E',
  medianIncome = 'B19013_001E',
}


const fields = [
  CensusDataSet.totalPopulation,
  CensusDataSet.medianIncome,
  CensusDataSet.whitePopulation,
  CensusDataSet.latinoPopulation,
  CensusDataSet.blackPopulation,
  CensusDataSet.renterUnits,
  CensusDataSet.housingUnits,
]

export class DemographicsProvider extends BaseProvider {
  lookupResults: Record<string, any> = {}

  getProperty = (key: string, zipCode: string) => {
    return censusClient.get('/', {
      params: {
        get: `NAME,${key}`,
        for: `zip code tabulation area:${zipCode}`,
        key: '49d40fb2a2f127f45070f8d7c2110fdceb87dbe6'
      }
    })
  }

  private parseLookupResult = (key: CensusDataSet) => {
    return this.lookupResults[key]?.[1][1] ? Number(this.lookupResults[key]?.[1][1]) : null
  }

  getData = async () => {
    const { property } = this.model
    const address = property.address.fullAddress
    const lookupDetails = await getLookupData(property.id, 'address_lookup')

    const { zipCode } = lookupDetails


    // a hack because API is inconsistent. ask for each metric three times in hopes it will eventually work out;
    for (const field of [...fields, ...fields, ...fields]) {
      try {
        if (!this.lookupResults[field]) {
          const { data } = await this.getProperty(field, zipCode)
          this.lookupResults[field] = data
        }
      } catch (e) {
        console.warn(`Could not get census data for property ${field}`)
      }
    }


    const demographicsData = {
      totalPopulation: this.parseLookupResult(CensusDataSet.totalPopulation),
      whitePopulation: this.parseLookupResult(CensusDataSet.whitePopulation),
      latinoPopulation: this.parseLookupResult(CensusDataSet.latinoPopulation),
      blackPopulation: this.parseLookupResult(CensusDataSet.blackPopulation),
      medianIncome: this.parseLookupResult(CensusDataSet.medianIncome),
      housingUnits: this.parseLookupResult(CensusDataSet.housingUnits),
      renterUnits: this.parseLookupResult(CensusDataSet.renterUnits),
    }


    await saveLookupResult(property.id, 'demographics_data', demographicsData, address)

    return {
      demographics_data: demographicsData
    }
  }
}
