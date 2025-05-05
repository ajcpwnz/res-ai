import axios from 'axios'
import { BaseProvider } from 'providers/base'
import { getLookupData, saveLookupResult } from 'utils/db.ts'

const placesClient = axios.create({
  baseURL: 'https://places.googleapis.com/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

const radius = 1609 // a mile;

const types = ['hospital', 'university', 'shopping_mall']
// const keyword = 'Trader Joe’s'

export class PlacesListProvider extends BaseProvider {
  getData = async () => {
    const { property } = this.model;

    const address = property.address.fullAddres;

    const lookupDetails = await getLookupData(property.id, 'address_lookup')

    const location = { lat: lookupDetails.latitude, lng: lookupDetails.longitude }

    const { data: { places } } = await placesClient.post(
      '/places:searchNearby',
      {
        includedTypes: types,
        locationRestriction: {
          circle: {
            center: {
              latitude: location.lat,
              longitude: location.lng,
            },
            radius,
          },
        },
      },
      {
        headers: {
          'X-Goog-Api-Key': process.env.GOOGLE_API_KEY,
          'X-Goog-FieldMask': 'places.name,places.formattedAddress,places.types',
        },
      }
    )

    for (const place of places) {
      await saveLookupResult(property.id, 'related_place', place, address)
    }

  }
}
