import { PrismaClient } from 'prisma'

export const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

export const createPropertyMeta = async (propertyId: string, key: string, value: any, json?: any) => {
  return prisma.propertyMeta.upsert({
    where: {
      propertyId_key: { propertyId, key },
    },
    create: {
      propertyId,
      key,
      value: `${value}` ?? null,
      json: json ?? null,
    },
    update: {
      value: `${value}` ?? undefined,
      json: json ?? undefined,
    },
  })
}


export const createPropertyMetas = async (
  propertyId: string,
  metas: Record<string, any>
): Promise<any[]> => {
  const operations = Object.entries(metas)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) =>
      prisma.propertyMeta.upsert({
        where: {
          propertyId_key: { propertyId, key },
        },
        create: {
          propertyId,
          key,
          value: `${value}`,
          json: null,
        },
        update: {
          value: `${value}`,
          json: undefined,
        },
      })
    )

  if (operations.length === 0) {
    return []
  }

  return prisma.$transaction(operations)
}


export const updateUnitConfig = async (id: string, rent_low: number, rent_high: number, rent_avm: number, fmr: number) => {
  return prisma.unitConfiguration.update({
    where: {
      id
    },
    data: {
      rent_avm,
      rent_high,
      rent_low,
      fmr
    },
  })
}


export const saveLookupResult = async (propertyId: string, type: string, value: any, address?: string) => {
  return prisma.lookupResult.create({
    data: {
      propertyId,
      resultType: type,
      input: address,
      json: JSON.stringify(value)
    }
  })
}

export const saveLookupResults = async (propertyId: string, type: string, records: any[], address?: string) => {
  await prisma.lookupResult.deleteMany({
    where: {
      propertyId,
      resultType: type,
    }
  })

  return prisma.lookupResult.createMany({
    data: records.map((record: any) => {
      return {
        propertyId,
        resultType: type,
        input: address,
        json: JSON.stringify(record)
      }
    }),
  })
}


export const getLookupData = async (propertyId: string, type: string) => {
  const [result] = await prisma.lookupResult.findMany({
    where: {
      propertyId,
      resultType: type,
    }
  })

  return JSON.parse(result.json)
}


export const loadProperty = async (id: string) => {
  const dbProperty = await prisma.property.findUnique({
    where: { id },
    include: { address: true, PropertyMeta: true, units: true }
  })

  const { PropertyMeta, ...baseFields } = dbProperty

  const meta = PropertyMeta.reduce<Record<string, any>>((metas, rec) => {
    metas[rec.key] = rec.value
    return metas
  }, {})

  return {
    ...baseFields,
    meta
  }
}

