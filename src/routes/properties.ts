import { Router } from 'express'
import { matchModel } from 'models/index.ts'
import { PrismaClient } from 'prisma'
import { jobQueue } from '../queues'
import { emit } from '../sockets'
import { createPropertyMeta, loadProperty } from 'utils/db.ts'

const prisma = new PrismaClient()

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
    type, address, unit_count
  } = req.body

  try {
    const Model = matchModel(type)

    const property = await prisma.property.create({
      data: {
        type,
        stage: Model.defaultStage,
        address: {
          create: {
            fullAddress: address
          }
        },
      },
      include:
        {
          address: true,
        }
    });

    await createPropertyMeta(property.id, 'unit_count', unit_count);

    res.json({ property })
  } catch (error) {
    res.status(500)
  }
})


router.put(`/:id`, async (req, res) => {
  try {
    const { id } = req.params

    const metas = req.body

    for (const [key, value] of Object.entries(metas)) {
      if (!value) continue

      await createPropertyMeta(id, key, value)
    }

    console.warn('aaaaa')
    return res.status(200).json({ success: true })
  } catch (error) {
    res.status(500)
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

      emit(`finish_assesment`, {
        property,
        data,
        stage: assessment.currentStage
      })
    } catch (error: any) {
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

  const pdfBuffer = await assessment.getReport();
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="Assessment - ${property.address?.fullAddress}.pdf"`,
    'Content-Length': pdfBuffer.length
  })
  res.status(200).end(pdfBuffer)
})


export default router
