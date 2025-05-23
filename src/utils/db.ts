import { json } from 'express'
import {PrismaClient} from 'prisma'
const prisma = new PrismaClient();

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
    where:{
      propertyId,
      resultType: type,
    }
  });

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


export const getLookupData = async (propertyId: string, type: string)=> {
  const [result] = await prisma.lookupResult.findMany({
    where: {
      propertyId,
      resultType: type,
    }
  });

  return JSON.parse(result.json);
}



export const loadProperty = async (id: string)=> {
  const dbProperty = await prisma.property.findUnique({
    where: { id },
    include: {address: true, PropertyMeta: true}
  });

  const { PropertyMeta, ...baseFields} = dbProperty;

  const meta = PropertyMeta.reduce<Record<string, any>>((metas, rec) => {
    metas[rec.key] = rec.value;
    return metas;
  }, {})

  return {
    ...baseFields,
    meta
  }
}

