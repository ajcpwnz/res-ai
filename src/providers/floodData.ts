import axios from 'axios'
import { BaseProvider } from 'providers/base'
import { createPropertyMeta } from 'utils/db.ts'

const API_KEY = 'vF1MTfIpId1XTt76Sf9Mi7ujqJSGOLEB5VWCDCj9'
const CLIENT_ID = '1qf8bipffjjske57m64o3fb5rt'

export class FloodDataProvider extends BaseProvider {
  getData = async () => {
    const {property} = this.model;
    const address = property.address.fullAddress

    const { data: {result: data} } = await axios.get('https://api.nationalflooddata.com/v3/data', {
      headers: {
        'X-API-KEY': API_KEY,
      },
      params: {
        address,
        'searchtype': 'addressparcel',
        'loma': false,
        'elevation': true
      }
    });


    const floodZone = data["flood.s_fld_haz_ar"]?.[0]?.fld_zone;

    if(floodZone) {
      await createPropertyMeta(property.id, 'flood_zone', floodZone);
    }
  }
}
