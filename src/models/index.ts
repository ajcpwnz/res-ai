import { ResidentialModel } from './residential.ts'
import { type ModelAssesment, ModelType, type PropertyDetails } from './types.ts'

type ModelConstructor = new (property: PropertyDetails) => ModelAssesment;

export const models: Record<ModelType, ModelConstructor> = {
  [ModelType.Residential]: ResidentialModel,
  [ModelType.MultiFamily]: ResidentialModel
}
