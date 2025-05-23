import type { ModelAssesment, PropertyWithAddress } from 'models/types'

export interface DataProvider {
  model: Omit<ModelAssesment, 'property'> & {property: PropertyWithAddress},
  getData: () => Promise<any>
}


export type ProviderConstructor = new (model: ModelAssesment) => DataProvider

export class BaseProvider implements DataProvider {
  model: DataProvider['model'];

  constructor(model: ModelAssesment) {
    if(!model.property || !model.property.address?.fullAddress) {
      throw new Error(`No address specified`)
    }

    this.model = model as DataProvider['model'];
  }

  getData: () => Promise<any>;
}
