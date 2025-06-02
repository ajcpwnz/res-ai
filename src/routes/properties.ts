import { Router, text } from 'express'
import { matchModel } from 'models/index.ts'
import { createProperty } from 'utils/db/properties.ts'
import { openai } from 'utils/oai.ts'
import { jobQueue } from '../queues'
import { emit } from '../sockets'
import { createPropertyMetas, loadProperty, prisma } from 'utils/db'
import multer from 'multer'

const pdfParse = require('pdf-parse')
import openaiTokenCounter from 'openai-gpt-token-counter'

const router = Router()

router.get('/', async (req, res) => {
  const properties = await prisma.property.findMany({
    where: {},
    include: {
      address: true
    }
  })

  res.json({ properties })
})

router.get('/:id', async (req, res) => {
  const { id } = req.params

  const property = await loadProperty(id)
  res.json({ property })
})

router.post('/', async (req, res) => {
  const {
    type,
    address,
    units,
  } = req.body

  try {
    const property = await createProperty({
      type,
      address,
      units
    })

    return res.json({ property })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Could not create property' })
  }
})


router.put('/:id', async (req, res) => {
  const { id } = req.params
  const { units, update_units, ...metas } = req.body


  try {
    await createPropertyMetas(id, metas);


    if (update_units?.length) {
      const updates = update_units.map((u: any) => {
        const { id: unitId, ...data } = u
        return prisma.unitConfiguration.update({
          where: { id: unitId },
          data,
        })
      })

      await prisma.$transaction(updates)
    } else if (Array.isArray(units)) {
      await prisma.unitConfiguration.deleteMany({
        where: { propertyId: id }
      })

      if (units.length > 0) {
        await prisma.unitConfiguration.createMany({
          data: units.map((u: any) => ({
            propertyId: id,
            bedrooms: u.bedrooms,
            bathrooms: u.bathrooms,
            quantity: u.quantity,
          }))
        })
      }
    }

    return res.status(200).json({ success: true })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Could not update property' })
  }
})


router.post(`/:id/process`, async (req, res) => {
  const { id } = req.params

  // Respond immediately to client
  res.json({ status: 'queued', propertyId: id })


  jobQueue.add(async () => {
    const property = await loadProperty(id)

    try {
      if (!property) {
        emit(`fail_assesment`, { error: 'Property not found', id })
        return
      }

      const Model = matchModel(property.type)
      const assessment = new Model(property)

      emit(`start_assesment`, { stage: assessment.currentStage, id })
      const data = await assessment.processStage(assessment.currentStage)

      const updated = await prisma.property.update({
        where: {
          id: property.id
        },
        data: {
          stageCompleted: true
        }
      })

      emit(`finish_assesment`, {
        property: { ...property, ...updated },
        data,
        stage: assessment.currentStage
      })

    } catch (error: any) {
      await prisma.property.update({
        where: {
          id: property.id
        },
        data: {
          stageCompleted: true
        }
      })

      emit(`fail_assesment`, { error: error.message || 'Unexpected error', id, stage: property.stage })
    }
  })
})


router.post(`/:id/advance`, async (req, res) => {
  const { id } = req.params

  try {
    const property = await loadProperty(id)
    if (!property) {
      emit(`fail_assesment`, { error: 'Property not found', id })
      return
    }

    const Model = matchModel(property.type)
    const assessment = new Model(property)

    const data = await assessment.advanceStage()

    const updated = await prisma.property.update({
      where: {
        id: property.id
      },
      data: {
        stage: assessment.currentStage,
        stageCompleted: false
      },
      include: {
        address: true
      }
    })


    res.json(updated)
  } catch (error: any) {
    res.status(404).send()
  }
})

router.post(`/:id/rewind`, async (req, res) => {
  const { id } = req.params

  try {
    const property = await loadProperty(id)
    if (!property) {
      emit(`fail_assesment`, { error: 'Property not found', id })
      return
    }

    const Model = matchModel(property.type)
    const assessment = new Model(property)

    await assessment.rewindStage()

    const updated = await prisma.property.update({
      where: {
        id: property.id
      },
      data: {
        stage: assessment.currentStage
      },
      include: {
        address: true
      }
    })


    res.json(updated)
  } catch (error: any) {
    res.status(404).send()
  }
})


router.post('/:id/assesment', async (req, res) => {
  const { id } = req.params
  const property = await loadProperty(id)
  const Model = matchModel(property.type)
  const assessment = new Model(property)

  const state = await assessment.loadState()

  return res.json(state)
})

router.delete('/:id', async (req, res) => {
  const { id } = req.params
  try {
    await prisma.lookupResult.deleteMany({ where: { propertyId: id } })
    await prisma.propertyMeta.deleteMany({ where: { propertyId: id } })
    await prisma.address.deleteMany({ where: { propertyId: id } })
    await prisma.property.delete({ where: { id } })
    res.status(200).json({ success: true })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

router.get('/:id/report', async (req, res) => {
  const { id } = req.params
  const property = await loadProperty(id)
  const Model = matchModel(property.type)
  const assessment = new Model(property)

  const pdfBuffer = await assessment.getReport()
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="Assessment - ${property.address?.fullAddress}.pdf"`,
    'Content-Length': pdfBuffer.length
  })
  res.status(200).end(pdfBuffer)
})

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
})

router.post(
  '/parse',
  upload.single('file'),
  async (req, res) => {
    // 1. Make sure a file was uploaded
    if (!req.file) {
      return res
        .status(400)
        .json({ error: 'No file uploaded. Please send a field named "file".' })
    }

    // 2. Extract plain text from the PDF buffer
    let fullText: string
    try {
      const data = await pdfParse(req.file.buffer)
      fullText = data.text || ''         // data.text is a big string
    } catch (err: any) {
      console.error('PDF parsing failed:', err)
      return res.status(500).json({ error: 'Failed to parse PDF.' })
    }

    const MODEL = 'gpt-4o'
    const MAX_TOKENS = 16000

    const configPrompt = `
You are an expert document parser. Extract the following JSON fields from the text:
{
  "address": The full address of the property, in the format of Street, City, State, Zip, string,
  "type": 'SingleFamily' if 1 unit, 'Residential' if 2-4 units, 'MultiFamily' if more than 4,
  "units": an array of unit breakdown, shaped like this: {"bathrooms": number, "bedrooms": number, "quantity": number}. For SingleFamily it will have one entry.
  "square_footage": number,
  "lot_size_sqft": number,
  "year_built": number,
  "assessed_value": number,
  "annual_property_tax": number,
  "last_sold_date": date,
  "last_sold_price": number,
  "zip_code": number
}

Strict rules:
1. Output must be valid JSON only. Do NOT wrap it in markdown or backticks.
2. Do NOT include any comments or explanatory text—only the JSON object itself.
3. If a field is missing or cannot be found, set it to null (or an empty array for "authors").
4. Do not introduce additional properties; output exactly these four keys in this order.

Begin:
`.trim()

    // 5. Count tokens of the configPrompt
    const promptTokens = openaiTokenCounter.text(configPrompt, MODEL)

    // 6. Reserve some tokens for the model’s final JSON reply. (Choose a safe margin, e.g. 500 tokens.)
    const TOKENS_FOR_COMPLETION = 2000

    // 7. Compute how many tokens remain for “file text”
    //    If promptTokens + TOKENS_FOR_COMPLETION > MAX_TOKENS, you’ll need to shrink TOKENS_FOR_COMPLETION or the prompt.
    if (promptTokens + TOKENS_FOR_COMPLETION >= MAX_TOKENS) {
      return res
        .status(500)
        .json({ error: 'Prompt is too large to fit in model context window.' })
    }

    const maxFileTokens = MAX_TOKENS - promptTokens - TOKENS_FOR_COMPLETION

    let fileTokens = openaiTokenCounter.text(fullText, MODEL)

    let truncatedText = fullText
    if (fileTokens > maxFileTokens) {
      let chunk = truncatedText
      while (openaiTokenCounter.text(chunk, MODEL) > maxFileTokens) {
        chunk = chunk.slice(0, Math.floor(chunk.length * 0.9))
      }
      truncatedText = chunk
      fileTokens = openaiTokenCounter.text(truncatedText, MODEL)
    }

    const messages = [
      {
        role: 'system',
        content:
          'You are a JSON‐only parser. Always follow the instructions exactly and output valid JSON only.',
      },
      {
        role: 'user',
        content: configPrompt + '\n\nDOCUMENT_TEXT_BEGIN\n' + truncatedText + '\nDOCUMENT_TEXT_END',
      },
    ]

    const totalUsed = promptTokens + fileTokens
    console.log(
      `Prompt tokens: ${promptTokens}, ` +
      `file tokens: ${fileTokens}, ` +
      `reserved for completion: ${TOKENS_FOR_COMPLETION}, ` +
      `TOTAL: ${totalUsed + TOKENS_FOR_COMPLETION}` // should be <= MAX_TOKENS
    )

    try {
      const completion = await openai.chat.completions.create({
        model: MODEL,
        messages: messages,
        temperature: 0,
        max_completion_tokens: TOKENS_FOR_COMPLETION,
      })

      const reply = completion.choices[0].message?.content?.trim() || ''

      let parsedJson: any = null
      try {
        parsedJson = JSON.parse(reply)
      } catch (parseErr) {
        console.error('Failed to parse JSON from GPT reply:', parseErr)
        console.warn('Raw GPT reply was:', reply)
        return res.status(500).json({
          error: 'Model did not return valid JSON. See server log for details.',
          raw: reply,
        })
      }

      const {
        address, type, units, ...metas
      } = parsedJson

      const property = await createProperty({ address, units, type }, { stageCompleted: true })
      await createPropertyMetas(property.id, metas);

      return res.json({ property, metas });
    } catch (openaiErr: any) {
      console.error('OpenAI API error:', openaiErr)
      return res.status(500).json({ error: 'OpenAI API request failed.' })
    }
  }
)

export default router
