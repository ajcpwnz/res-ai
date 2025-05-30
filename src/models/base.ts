import {
  type ModelAssesment,
  type ModelAssesmentStage,
  ModelType,
  type PropertyDetails,
  type StageKey
} from 'models/types.ts'
import { providers } from 'providers/index.ts'
import { emit } from '../sockets'

const defaultStage = 'stage_1'

export class BaseModel implements ModelAssesment {
  static defaultStage = defaultStage

  done = false

  type = ModelType.Residential

  currentStage: StageKey

  order: StageKey[]

  property: PropertyDetails

  meta: Record<string, any> = {}



  processStage = async (stage: StageKey) => {
    const stageConfig = this.stages[stage]

    if (!stageConfig) {
      return
    }

    console.warn(`] processing stage '${stage}'`)

    const result: Record<string, any> = {}

    let error = null;

    for (const dataSource of stageConfig.outputs) {
      const Provider = providers[dataSource]

      if (!Provider) {
        console.warn(`Provider '${dataSource}' not found`)
        continue
      }

      const provider = new Provider(this)
      console.warn(`Getting data for ${dataSource}`)
      try {
        result[dataSource] = await provider.getData()
      } catch (e) {
        error = e;
        console.error(`Error getting data for ${dataSource}`);
        console.error(e);
      }

      console.warn(`Done with ${dataSource}`)

      emit('provider_data_received', {
        id: this.property.id,
        stage: this.currentStage,
        dataSource,
        data: result[dataSource]
      })
    }

    if(error) {
      throw error;
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


  getReport = () => {
    if (this.property.stage !== 'stage_5') return
    const dataSource = this.stages[this.currentStage].outputs[0]
    const Provider = providers[dataSource]
    const provider = new Provider(this)
    return provider.getData()
  }
}
