import { matchModel } from 'models/index'
import type { ModelType } from 'models/types'
import { type UnitConfiguration } from 'prisma'
import { prisma } from 'utils/db/index.ts'

export const createProperty = (
  {
    address,
    type,
    units,
    userId,
  }: {
    userId: string
    address: string
    units: UnitConfiguration[]
    type: ModelType
  },
  overrides: Record<string, any>
) => {
  const Model = matchModel(type)

  return prisma.property.create({
    data: {
      type,
      stage: Model.defaultStage,
      ...overrides,
      userId,
      address: {
        create: { fullAddress: address },
      },
      units: units ? {
        create: units.map((u: any) => ({
          bedrooms: u.bedrooms,
          bathrooms: u.bathrooms,
          quantity: u.quantity,
        })),
      } : undefined,
    },
    include: {
      address: true,
      units: true,
    },
  })
}
