import { PrismaClient } from 'prisma'
import { emit } from '../sockets'
import { loadProperty } from 'utils/db.ts'
import { DataSource, providers } from '../providers'
import {
  type ModelAssesment,
  type ModelAssesmentStage,
  ModelType,
  type PropertyDetails,
  type StageKey
} from '../models/types'

import { PrismaClient } from 'prisma'

const prisma = new PrismaClient()

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
      DataSource.FloodData,
      DataSource.HUDFmr,
      DataSource.CensusDemographicsReport,
      DataSource.GooglePlacesList,
      DataSource.PerplexityLocalData
    ]
  },
  stage_3: {
    key: 'stage_3',
    outputs: [
      DataSource.DerivedMultifamilyExpenseRatio
    ]
  },
  stage_4: {
    key: 'stage_4',
    outputs: [
      DataSource.DerivedMultifamilyFinancialProjections
    ]
  },
  stage_5: {
    key: 'stage_5',
    final: true,
    outputs: [
      DataSource.DerivedMultifamilyInvestmentSummary
    ]
  }
}

const defaultStage = 'stage_1'

export class MulifamilyModel implements ModelAssesment {
  static defaultStage = defaultStage

  done = false

  type = ModelType.Residential

  stages: Record<StageKey, ModelAssesmentStage> = {
    ...defaultStages,
  }

  currentStage: StageKey

  order: StageKey[]

  property: PropertyDetails

  meta: Record<string, any> = {}

  constructor(property: PropertyDetails) {
    this.order = Object.keys(this.stages)
    this.property = property
    this.currentStage = property.stage || defaultStage
  }

  prepare = async () => {
    console.warn('preparing to process residential model')
  }

  reload = async () => {
    this.property = await loadProperty(this.property.id)
  }

  processStage = async (stage: StageKey) => {
    const stageConfig = this.stages[stage]

    if (!stageConfig) {
      return
    }

    console.warn(`] processing stage '${stage}'`)

    const result: Record<string, any> = {}

    for (const dataSource of stageConfig.outputs) {
      const Provider = providers[dataSource]

      if (!Provider) {
        console.warn(`Provider '${dataSource}' not found`)
        continue
      }

      const provider = new Provider(this)

      result[dataSource] = await provider.getData()

      emit('provider_data_received', {
        id: this.property.id,
        stage: this.currentStage,
        dataSource,
        data: result[dataSource]
      })
    }

    return result
  }


  advanceStage = async () => {
    const stage = this.currentStage

    const stageConfig = this.stages[stage]
    const currentIndex = this.order.indexOf(stage)

    if (this.order[currentIndex + 1] !== undefined) {
      this.currentStage = this.order[currentIndex + 1]!
    }

    if (stageConfig.final) {
      this.done = true
    }
  }

  rewindStage = async () => {
    const stage = this.currentStage

    const currentIndex = this.order.indexOf(stage)

    if (this.order[currentIndex - 1] !== undefined) {
      this.currentStage = this.order[currentIndex - 1]!
    } else {
      this.currentStage = defaultStage
    }
  }

  loadState = async () => {
    const { meta } = this.property

    const lookupResults = await prisma.lookupResult.findMany({
      where: { propertyId: this.property.id }
    })

    const tryParseJson = (row?: { json: string }) => {
      if (!row) return undefined
      try {
        return JSON.parse(row.json)
      } catch {
        return undefined
      }
    }

    const findJson = (type: string) =>
      tryParseJson(lookupResults.find(row => row.resultType === type))

    const allStates: Record<StageKey, any> = {
      stage_1: {
        [DataSource.RentCastAddressLookup]: {
          property_type: meta?.property_type,
          bedrooms: meta?.bedrooms,
          bathrooms: meta?.bathrooms,
          square_footage: meta?.square_footage,
          lot_size_sqft: meta?.lot_size_sqft,
          year_built: meta?.year_built,
          assessed_value: meta?.assessed_value,
          annual_property_tax: meta?.annual_property_tax,
          zip_code: meta?.zip_code,
          unit_count: meta?.unit_count,
        }
      },
      stage_2: {
        [DataSource.RentCastMarketData]: {
          marketData: {
            avg_rent: meta?.avg_rent,
            rent_low: meta?.rent_low,
            rent_high: meta?.rent_high,
          },
          comparables: lookupResults
            .filter(r => r.resultType === 'rent_comp')
            .map(r => tryParseJson(r))
            .filter(Boolean)
        },
        [DataSource.RentCastSalesComp]: {
          avm: { avm_value: meta?.avm_value },
          comparables: lookupResults
            .filter(r => r.resultType === 'sales_comp')
            .map(r => tryParseJson(r))
            .filter(Boolean)
        },
        [DataSource.FloodData]: { flood_zone: meta?.flood_zone },
        [DataSource.HUDFmr]: { fmr: meta?.fmr },
        [DataSource.CensusDemographicsReport]: {
          demographics_data: findJson('demographics_data')
        },
        [DataSource.GooglePlacesList]: {
          related_places: lookupResults
            .filter(r => r.resultType === 'related_place')
            .map(r => tryParseJson(r))
            .filter(Boolean)
        },
        [DataSource.PerplexityLocalData]: {
          vacancy: meta?.vacancy,
          localData: findJson('local_data')
        }
      },
      stage_3: {
        [DataSource.DerivedMultifamilyExpenseRatio]: {
          expense_rate:               meta?.expense_rate,
          expense_rate_type:          meta?.expense_rate_type,
          income_growth:              meta?.income_growth,
          expense_growth:             meta?.expense_growth,
          renovation_scope:           meta?.renovation_scope,
          renovation_cost:            meta?.renovation_cost,
          renovation_units_per_month: meta?.renovation_units_per_month,
        }
      },
      stage_4: {
        [DataSource.DerivedMultifamilyFinancialProjections]: {
          financial_projection: findJson('financial_projection')
        }
      },
      stage_5: {
        [DataSource.DerivedMultifamilyInvestmentSummary]: {}
      }
    }

    const currentIndex = this.order.indexOf(this.currentStage)
    const allowedStages = this.order.slice(0, currentIndex + 1)

    return Object.fromEntries(
      allowedStages.map(stage => [stage, allStates[stage]])
    ) as Record<StageKey, any>
  }



  getReport = () => {
    // if (this.property.stage !== 'stage_5') return;
    const dataSource = this.stages[this.currentStage].outputs[0]
    const Provider = providers[dataSource]
    const provider = new Provider(this)
    return provider.getData()
  }
}
