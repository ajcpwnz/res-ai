import axios from 'axios'
import { BaseProvider } from 'providers/base'
import { rentcastClient } from 'utils/api/rentcast'
import { createPropertyMetas, prisma, saveLookupResult } from 'utils/db'
import type { xAddressLookupResult } from '../../samples/addressLookup'

const geocodeClient = axios.create({
  baseURL: 'https://maps.googleapis.com/maps/api',
  headers: { 'Content-Type': 'application/json' },
})

type Unit = {
  bedrooms: number
  bathrooms: number
  quantity: number
}

const formatUnits = (originalUnits: any): Unit[] => {
  if (!Array.isArray(originalUnits)) return []

  const validUnits: Unit[] = []
  for (const unit of originalUnits) {
    if (unit && typeof unit === 'object') {
      const bedrooms = Number((unit as any).bedrooms)
      const bathrooms = Number((unit as any).bathrooms)
      const quantity = Number((unit as any).quantity)
      if (!Number.isNaN(bedrooms) && !Number.isNaN(bathrooms) && !Number.isNaN(quantity)) {
        validUnits.push({ bedrooms, bathrooms, quantity })
      }
    }
  }

  const seen = new Set<string>()
  const deduped: Unit[] = []
  for (const u of validUnits) {
    const key = `${u.bedrooms}/${u.bathrooms}`
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(u)
    }
  }

  return deduped
}

const systemPrompt = `
You are a local data specialist.  When given an address, respond with exactly one JSON object—nothing else, no explanation, no markdown, no backticks.

The JSON must have these fields (all required):
{
  "rentcast_property_type": 'SingleFamily' if one unit. 'Residential' if 2-4 units. 'MultiFamily' if more than 4,
  "square_footage": number,
  "lot_size_sqft": number,
  "year_built": number,
  "assessed_value": number,
  "annual_property_tax": number,
  "zip_code": string,
  "last_sold_date": string,
  "last_sold_price": number,
  "unit_count": number,
  "units": [
    {
      "bedrooms": number,
      "bathrooms": number,
      "quantity": number
    },
    …
  ]
}
  `

interface AddressLookupResult {

}

export class AddressLookupProvider extends BaseProvider {
  results: Record<string, any> = {}

  private extractJSON(text: string): string {
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) throw new Error(`No JSON object found in response:\n${text}`)
    return m[0]
  }

  private async askPerplexity(address: string): Promise<AddressLookupResult> {
    const resp = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Property address: ${address}` }
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    )
    const raw = resp.data.choices?.[0]?.message?.content?.trim() ?? ''
    const jsonText = this.extractJSON(raw)
    let parsed: any
    try {
      parsed = JSON.parse(jsonText)
    } catch (e: any) {
      throw new Error(`Failed to parse JSON: ${e.message}\n${jsonText}`)
    }

    return parsed;
  }

  private lookupAddress = async (address: string) => {
    const { data } = await geocodeClient.get('/geocode/json', {
      params: { address, key: process.env.GOOGLE_API_KEY }
    })

    if (data.status !== 'OK' || !data.results.length) {
      throw new Error(`Geocoding failed: ${data.status}`)
    }

    const result = data.results[0]
    const comps = result.address_components

    const getComp = (type: string) =>
      comps.find(c => c.types.includes(type))

    const stateComp = getComp('administrative_area_level_1')
    const state = stateComp?.short_name || null
    const zipComp = getComp('postal_code')
    const zip = zipComp?.long_name || null

    let countyComp = getComp('administrative_area_level_2')
    let county = countyComp?.long_name || null
    if (!county) {
      const localityComp = getComp('locality')

      if (localityComp?.long_name) {
        county = localityComp.long_name
      }
    }

    const { lat, lng } = result.geometry.location

    return {
      state,
      county,
      zip,
      latitude: lat,
      longitude: lng,
    }
  }

  private saveAddressLookupResult = async () => {
    const { property } = this.model
    const address = property.address.fullAddress

    let data = this.results.data;

    if (!(['state', 'county', 'zip', 'latitude', 'longitude'].every(key => data?.[key]))) {
      data = await this.lookupAddress(address);
    }

    if(data) {
      await saveLookupResult(property.id, 'address_lookup', data, address)
    }
  }

  private getRentcastDetails = async (address: string) => {
    const { property } = this.model
    const { meta } = property

    try {
      const { data: [data] } = await rentcastClient.get<xAddressLookupResult[]>('/properties', {
        params: { address }
      })

      if (!data) {
        return undefined
      }

      this.results.data = data;

      const assesment = Object.values(data.taxAssessments || {}).pop()
      const propertyTax = Object.values(data.propertyTaxes || {}).pop()

      return {
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

        // TODO;
        unit_count: data.features?.unitCount || meta.unit_count || 1,
      }

    } catch (e) {
      return undefined
    }
  }

  getData: () => Promise<AddressLookupResult> = async () => {
    const { property } = this.model
    const address = property.address.fullAddress

    let [rentcastDetails, perplexityDetails] = await Promise.all([
      this.getRentcastDetails(address),
      this.askPerplexity(address)
    ]);

    const merged: Partial<AddressLookupResult> = {
      ...(rentcastDetails ?? {})
    };

    if (perplexityDetails) {
      // Object.entries returns [key, value][] – so use `of`, not `in`
      for (const [key, value] of Object.entries(perplexityDetails)) {
        if (value != null && (merged as any)[key] == null) {
          (merged as any)[key] = value;
        }
      }
    }

    const addressDetails = merged

    await createPropertyMetas(property.id, addressDetails)

    const formattedUnits = formatUnits(addressDetails.units);

    await prisma.property.update({
      data: {
        type: perplexityDetails.rentcast_property_type,
        units: {
          create: formattedUnits
        }
      },
      where: {
        id: property.id
      }
    })

    // good to have: sync metas;

    await this.saveAddressLookupResult()

    return {
      ...addressDetails,
      units: formattedUnits
    }
  }
}
