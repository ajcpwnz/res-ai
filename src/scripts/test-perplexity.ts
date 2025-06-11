import axios from 'axios'

const main = async () => {
  const address = Bun.argv[2]

    const systemPrompt = `
    You are a local data specialist. You will be given an address. 
    Give ONLY data relevant for specified address, exactly as specified in JSON format, nothing else, no commentary, no backticks.
    
    requested format: 
    {
      stage_1: {
          rentcast_property_type: 'SingleFamily' if one unit. 'Residential' if 2-4 units. 'MultiFamily' if more than 4,
          square_footage: number,
          lot_size_sqft: number,
          year_built: year,
          assessed_value: number,
          annual_property_tax: number,
          zip_code: zip code,
          last_sold_date: date,
          last_sold_price: date,
          unit_count: number of units or 1,
          units: {
            bedrooms: number,
            bathrooms: number,
            quantity: number
          }[]
      }
    stage_2: {
      rent_data: array with following structure: for every unit entry in stage_1.units return a record with min, median, max rent based on rent comparables, hud fmr value and addresses for 2-3 rent comparables
      sale_data: {
        avm_value: value for this property based on market
        sales_comps: 2-5 sale comparables
      }
      flood_zone: nationalflooddata api flood zone descriptor
      demographics: based on census data with following structure {
        totalPopulation: number
        whitePopulation:  string formatted as number | percentage of total
        latinoPopulation: string formatted as  number | percentage of total
        blackPopulation: string formatted as  number | percentage of total
        medianIncome: number
        housingUnits: number
        renterUnits: string formatted as  number | percentage of housing units
      }
    }
  } 
`

  const response = await axios.post(
    'https://api.perplexity.ai/chat/completions',
    {
      model: "sonar-pro",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Property address: ${address}` }
      ],
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  )

  const content = response.data.choices[0].message.content.trim()
  const fileName = `perplexity — ${address}.txt`
  const bytesWritten = await Bun.write(fileName, content)
  console.log(`Saved ${bytesWritten} bytes to ${fileName}`)
}

main().then(() => process.exit(0))
