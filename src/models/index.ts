import { MulifamilyModel } from 'models/mulifamily'
import { ResidentialModel } from 'models/residential'
import { type ModelAssesment, ModelType, type PropertyDetails } from './types.ts'

interface ModelConstructor {
  new (property: PropertyDetails): ModelAssesment;
  defaultStage: string;
}
export const models: Record<ModelType, ModelConstructor> = {
  [ModelType.Residential]: ResidentialModel,
  [ModelType.SingleFamily]: ResidentialModel,
  [ModelType.MultiFamily]: MulifamilyModel
}

export const matchModel = (type: ModelType) => {
  return models[type];
}
