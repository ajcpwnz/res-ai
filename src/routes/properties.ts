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
    type,
    address,
    last_sold_date,
    last_sold_price,
    unit_count,
    units,
  } = req.body;

  try {
    const Model = matchModel(type);

    const createPayload = {
      data: {
        type,
        stage: Model.defaultStage,
        address: {
          create: { fullAddress: address },
        },
      },
      include: {
        address: true,
        units: true,
      },
    }

    if(type === 'MultiFamily') {
      createPayload.data.units = {
        create: units.map((u: any) => ({
          bedrooms: u.bedrooms,
          bathrooms: u.bathrooms,
          quantity: u.quantity,
        }))
      }
    }

    const property = await prisma.property.create(createPayload);

    if (last_sold_date) {
      await createPropertyMeta(property.id, 'last_sold_date', last_sold_date);
    }
    if (last_sold_price) {
      await createPropertyMeta(property.id, 'last_sold_price', last_sold_price);
    }

    if(type === 'SingleFamily') {
      await createPropertyMeta(property.id, 'unit_count', 1);
    } else {
      await createPropertyMeta(property.id, 'unit_count', unit_count);
    }

    return res.json({ property });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not create property' });
  }
});


router.put('/:id', async (req, res) => {
  const { id } = req.params
  const { units, update_units, ...metas } = req.body

  try {
    const property = await loadProperty(id)

    // TODO: do batch update;
    for (const [key, value] of Object.entries(metas)) {
      if (value == null || value === '') continue
      await createPropertyMeta(id, key, value)
    }


    if(update_units?.length) {
      const updates = update_units.map((u: any) => {
        const { id: unitId, ...data } = u
        return prisma.unitConfiguration.update({
          where: { id: unitId },
          data,
        })
      })

      await prisma.$transaction(updates)
    } else if (property.type ===  'MultiFamily' && Array.isArray(units)) {
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
    } else {
      const unit_count = property.type === 'Residential' ? metas.unit_count : 1

      await prisma.unitConfiguration.create({
        data: {
          propertyId: id,
          bedrooms: Number(metas.bedrooms),
          bathrooms: Number(metas.bathrooms),
          quantity: unit_count
        }
      })
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
        property: {...property, ...updated},
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

  const pdfBuffer = await assessment.getReport();
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="Assessment - ${property.address?.fullAddress}.pdf"`,
    'Content-Length': pdfBuffer.length
  })
  res.status(200).end(pdfBuffer)
})


export default router
