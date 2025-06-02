import { BaseModel } from 'models/base.ts'
import { loadProperty, prisma } from 'utils/db'
import { DataSource } from '../providers'
import {
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
      DataSource.CensusDemographicsReport,
      DataSource.GooglePlacesList,
      DataSource.PerplexityLocalData
    ]
  },
  stage_3: {
    key: 'stage_3',
    outputs: [
      DataSource.DerivedResidentialExpenseRatio
    ]
  },
  stage_4: {
    key: 'stage_4',
    outputs: [
      DataSource.DerivedResidentialFinancialProjections
    ]
  },
  stage_5: {
    key: 'stage_5',
    final: true,
    outputs: [
      DataSource.DerivedResidentialInvestmentSummary
    ]
  }
}

const defaultStage = 'stage_1'

export class ResidentialModel extends BaseModel {
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
    super()
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
          last_sold_date: meta?.last_sold_date,
          last_sold_price: meta?.last_sold_price,
          units: this.property.units
        }
      },
      stage_2: {
        [DataSource.RentCastMarketData]: {
          marketData: this.property.units,
          comparables: lookupResults
            .filter(row => row.resultType === 'rent_comp')
            .map(row => tryParseJson(row))
            .filter(Boolean)
        },
        [DataSource.RentCastSalesComp]: {
          avm: {
            avm_value: meta?.avm_value,
          },
          comparables: lookupResults
            .filter(row => row.resultType === 'sales_comp')
            .map(row => tryParseJson(row))
            .filter(Boolean)
        },
        [DataSource.FloodData]: {
          flood_zone: meta?.flood_zone
        },
        [DataSource.CensusDemographicsReport]: {
          demographics_data: findJson('demographics_data')
        },
        [DataSource.GooglePlacesList]: {
          related_places: lookupResults
            .filter(row => row.resultType === 'related_place')
            .map(row => tryParseJson(row))
            .filter(Boolean)
        },
        [DataSource.PerplexityLocalData]: {
          vacancy: meta?.vacancy,
          localData: findJson('local_data')
        }
      },
      stage_3: {
        [DataSource.DerivedResidentialExpenseRatio]: {
          expense_rate: meta?.expense_rate,
          expense_rate_type: meta?.expense_rate_type,
          renovation_scope: meta?.renovation_scope,
          renovation_cost: meta?.renovation_cost,
          avg_rent: meta?.avg_rent,
          vacancy: meta?.vacancy,
          units: this.property.units
        }
      },
      stage_4: {
        [DataSource.DerivedResidentialFinancialProjections]: {
          financial_projection: findJson('financial_projection')
        }
      },
      stage_5: {
        [DataSource.DerivedResidentialInvestmentSummary]: {}
      }
    }

    const currentIndex = this.order.indexOf(this.currentStage)
    const allowed = this.order.slice(0, currentIndex + 1)

    return Object.fromEntries(
      allowed.map(stage => [stage, allStates[stage]])
    ) as Record<StageKey, any>
  }
}
