import axios from 'axios'
import { BaseProvider } from 'providers/base'
import { createPropertyMeta, getLookupData, prisma, saveLookupResult } from 'utils/db'

const queries = [
  { key: "universityStudentCount", query: `How many students attend universities in `, meta: 'city' },
  { key: "economicDevelopment", query: `Describe recent economic development trends in ZIP code `, meta: 'zipCode' },
];

export class LocalDataProvider extends BaseProvider {
  private async askPerplexity(q: string, mode: 'summary' | 'decimal' = 'summary'): Promise<string> {
    const systemMessage = mode === 'summary'
      ? "You are a local data specialist. Respond with a short one sentence including key metric, no text formatting and no reference numbers, or 'no data available' if no data is available"
      : "You are a data analyst. Respond with only a single decimal number representing percentage as a fraction (e.g., 0.1 for 10%), no text, no formatting, no units, or '0.1' if unknown. Number can NEVER be higher than 1";

    const response = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: "sonar-pro",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: q }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data.choices[0].message.content.trim();
  }
  getData = async () => {
    const { property } = this.model
    const address = property.address.fullAddress;

    const lookupDetails = await getLookupData(property.id, 'address_lookup')
    const result: Record<string, any> = {};

    for (const query of queries) {
      const data = await this.askPerplexity(query.query + lookupDetails[query.meta]);

      result[query.key] = data;
    };

    const places = await prisma.lookupResult.findMany({
      where: {
        propertyId: property.id,
        resultType: 'related_place',
      },
      take: 6,
    })

    const vacancyPrompt = `What is the current commercial real estate vacancy rate in ${lookupDetails.city}, ${lookupDetails.zipCode}`

    const vacancy = await this.askPerplexity(vacancyPrompt, 'decimal');

    const placePrompt = `Take this JSON from google places api. Return JSON with 'size' field containing number of visitors for malls workers for hospitals and students for universities. Its important to not come up with fake numbers like number of hospital patients, and 'info' with a short 1 sentence summary of market data about this place. Either field should be 'N/A' if no information found`

    for (const place of places) {
      const fields = JSON.parse(place.json);

      const result = await this.askPerplexity(`${placePrompt}, ${place.json}`);

      try {
        const placeData = JSON.parse(result);

        const newFields = {
          ...fields,
          size: placeData.size,
          info: placeData.info,
        }

        await prisma.lookupResult.update({
          where: {
            id: place.id,
          },
          data: {
            json: JSON.stringify(newFields),
          }
        });

      } catch (e) {
        console.error(`Could not look up ${fields.name?.text} in perplexity`);
        console.error(e);
      }
    }

    await createPropertyMeta(property.id, 'vacancy', vacancy)
    await saveLookupResult(property.id, 'local_data', result, address)


    return {
      vacancy,
      localData: result
    }
  }
}
