import axios from 'axios'
import { BaseProvider } from 'providers/base'
import { getLookupData, saveLookupResult, saveLookupResults } from 'utils/db.ts'

const placesClient = axios.create({
  baseURL: 'https://places.googleapis.com/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

const radius = Math.round(1609.34 * 5);

const types = ['hospital', 'university', 'shopping_mall']
// const keyword = 'Trader Joe’s'

function haversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 3958.8; // Earth’s radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
    Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class PlacesListProvider extends BaseProvider {
  getData = async () => {
    const { property } = this.model
    const address = property.address.fullAddress

    const lookupDetails = await getLookupData(property.id, 'address_lookup')
    const location = {
      lat: lookupDetails.latitude,
      lng: lookupDetails.longitude,
    }

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
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.primaryType,places.location',
        },
      }
    )

    const normalized = places.slice(0,5).map(place => ({
      name: place.displayName,
      formattedAddress: place.formattedAddress,
      type: place.primaryType,
      distance: haversine(location.lat, location.lng, place.location.latitude, place.location.longitude),
    }))

    await saveLookupResults(property.id, 'related_place', normalized, address)

    return {
      related_places: normalized
    }
  }
}
