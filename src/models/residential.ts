import { loadProperty } from 'utils/db.ts'
import { DataSource, providers } from '../providers'
import {
  type ModelAssesment,
  type ModelAssesmentStage,
  ModelType,
  type PropertyDetails,
  type StageKey
} from '../models/types'

const defaultStages = {
  stage_1: {
    key: '',
    outputs: [
      DataSource.RentCastAddressLookup,
    ]
  },
  stage_2: {
    key: '',
    outputs: [
      DataSource.RentCastMarketData,
      DataSource.RentCastSalesComp,
      DataSource.FloodData,
      DataSource.HUDFmr,
      // DataSource.CensusDemographicsReport,
      DataSource.GooglePlacesList,
      DataSource.PerplexityLocalData
    ]
  },
  stage_3: {
    key: 'stage_3',
    outputs: [
      DataSource.DerivedExpenseRatio
    ]
  },
  stage_4: {
    key: 'stage_4',
    outputs: [
      DataSource.DerivedFinancialProjections
    ]
  },
  stage_5: {
    key: 'stage_5',
    final: true,
    outputs: [
      DataSource.DerivedInvestmentSummary
    ]
  }
}

export class ResidentialModel implements ModelAssesment {
  done = false

  type = ModelType.Residential

  stages: Record<StageKey, ModelAssesmentStage> = {
    ...defaultStages,
  }

  currentStage = 'stage_1'

  order: StageKey[];

  property: PropertyDetails;

  constructor(property: PropertyDetails) {
    this.order = Object.keys(this.stages);
    this.property = property;
  }

  prepare = async () => {
    console.warn('preparing to process residential model')
  }

  reload = async () => {
    this.property = await loadProperty(this.property.id)
  }

  processStage = async (stage: StageKey) => {
    const stageConfig = this.stages[stage];

    if(!stageConfig) {
      return;
    }

    console.warn(`] processing stage '${stage}'`);

    // get data
    for (const dataSource of stageConfig.outputs) {
      const Provider = providers[dataSource];

      if(!Provider) {
        console.warn(`Provider '${dataSource}' not found`);
        continue;
      }

      const provider = new Provider(this);

      await provider.getData();
    }

    // advance;
    const currentIndex = this.order.indexOf(stage);

    if(this.order[currentIndex + 1] !== undefined) {
      this.currentStage = this.order[currentIndex + 1]!;
    }

    if (stageConfig.final) {
      this.done = true
    }
  }
}
