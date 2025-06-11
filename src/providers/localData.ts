import axios from 'axios'
import { BaseProvider } from 'providers/base'
import { createPropertyMeta, getLookupData, prisma, saveLookupResult } from 'utils/db'

const queries = [
  { key: 'universityStudentCount', query: 'How many students attend universities in ', meta: 'city' },
  { key: 'economicDevelopment',   query: 'Describe recent economic development trends in ZIP code ', meta: 'zipCode' },
]

export class LocalDataProvider extends BaseProvider {
  getData = async () => {
    const { property } = this.model
    const address = property.address.fullAddress

    const lookupDetails = await getLookupData(property.id, 'address_lookup')
    const places = await prisma.lookupResult.findMany({
      where: { propertyId: property.id, resultType: 'related_place' },
      take: 6,
    })

    const compositePayload = {
      queries: queries.map(q => ({
        key: q.key,
        prompt: q.query + lookupDetails[q.meta],
      })),
      vacancyPrompt: `What is the current commercial real estate vacancy rate in ${lookupDetails.city}, ${lookupDetails.zipCode}?`,
      places: places.map(p => ({ id: p.id, data: JSON.parse(p.json) })),
    }

    const systemMessage = [
      'You are alocal data specialist',
      'Return STRICTLY parsable JSON with these top-level keys:',
      '- universityStudentCount: one-sentence string or "no data available"',
      '- economicDevelopment: one-sentence string or "no data available"',
      '- vacancy: a decimal between 0 and 1 (or 0.1 if unknown)',
      '- places: an array of objects with fields { id, size, info } where size is a number or "N/A", info is one sentence or "N/A".',
      'Do not wrap in markdown or backticks, do not output anything else.'
    ].join(' ')

    const llmResponse = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: JSON.stringify(compositePayload) },
        ],
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const parsed = JSON.parse(llmResponse.data.choices[0].message.content.trim())

    for (const { key } of queries) {
      // result[key] will be either a string or "no data available"
      (parsed as any)[key] && await saveLookupResult(property.id, key, (parsed as any)[key], address)
    }

    for (const place of parsed.places) {
      const original = places.find(p => p.id === place.id)!
      const updated = {
        ...JSON.parse(original.json),
        size: place.size,
        info: place.info,
      }
      await prisma.lookupResult.update({
        where: { id: place.id },
        data: { json: JSON.stringify(updated) },
      })
    }

    await createPropertyMeta(property.id, 'vacancy', parsed.vacancy);

    return {
      vacancy: parsed.vacancy,
      localData: {
        universityStudentCount: parsed.universityStudentCount,
        economicDevelopment: parsed.economicDevelopment,
      },
    }
  }
}
