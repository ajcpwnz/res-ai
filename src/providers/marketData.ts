import { BaseProvider } from 'providers/base';
import { rentcastClient } from 'utils/api/rentcast.ts';
import { hudClient } from 'utils/api/hud.ts';
import { saveLookupResults, updateUnitConfig, getLookupData } from 'utils/db';

const lookupKeys: Record<number | 'default', string> = {
  default: 'One-Bedroom',
  1: 'One-Bedroom',
  2: 'Two-Bedroom',
  3: 'Three-Bedroom',
  4: 'Four-Bedroom',
};

export class MarketDataProvider extends BaseProvider {
  getData = async () => {
    const { property } = this.model;
    const { meta } = property;
    const address = property.address.fullAddress;

    // Fetch HUD lookup details once
    const lookupDetails = await getLookupData(property.id, 'address_lookup');
    const { state, county, zipCode } = lookupDetails;

    // Fetch list of counties for the state
    const { data: counties } = await hudClient.get(`listCounties/${state}`);
    const lookupCounty = counties.find(
      (row: any) => row.county_name.toLocaleLowerCase() === county.toLocaleLowerCase() || row.county_name.toLocaleLowerCase().includes(county.toLocaleLowerCase())
    );

    // Fetch FMR data for the matched county
    let fmrEntry: any = null;
    if (lookupCounty) {
      const { fips_code } = lookupCounty;
      const { data: fmrResult } = await hudClient.get(`data/${fips_code}?year=2025`);

      if (!fmrResult.data.basicdata) {
        throw new Error(
          `No FMR data for ${property.address.fullAddress}, details: ${JSON.stringify(
            fmrResult.data
          )}`
        );
      }

      // Ensure basicdata is an array
      const basicData = Array.isArray(fmrResult.data.basicdata)
        ? fmrResult.data.basicdata
        : [fmrResult.data.basicdata];

      // Match ZIP code
      fmrEntry = basicData.find((row: any) => row.zip_code === zipCode) || null;
    }

    const units: any[] = [];
    let comps: any[] = [];

    for (const unitConfig of property.units) {
      // Fetch rent data
      const { data } = await rentcastClient.get('/avm/rent/long-term', {
        params: {
          address,
          propertyType: meta.rentcast_property_type,
          bedrooms: unitConfig.bedrooms,
          bathrooms: unitConfig.bathrooms,
          squareFootage: meta.square_footage,
          compCount: 25,
        },
      });

      const filteredComps = data.comparables
        ?.filter((row: any) => row.bedrooms === unitConfig.bedrooms)
        .slice(0, 2) || [];

      let fmrValue: number | undefined;
      if (fmrEntry) {
        const key = lookupKeys[unitConfig.bedrooms] || lookupKeys.default;
        fmrValue = fmrEntry[key];
      }

      const unit = await updateUnitConfig(
        unitConfig.id,
        data.rentRangeLow,
        data.rentRangeHigh,
        data.rent,
        fmrValue
      );

      units.push(unit);
      comps = comps.concat(filteredComps);
    }

    // Save all comps
    await saveLookupResults(property.id, 'rent_comp', comps, address);

    return {
      marketData: units,
      comparables: comps.slice(0, 5),
    };
  };
}
