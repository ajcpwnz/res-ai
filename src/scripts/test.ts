import { matchModel } from 'models/index.ts'
import { loadProperty } from 'utils/db.ts'
import dotenv from 'dotenv'

dotenv.config()

const main = async () => {
  const id = [...Bun.argv].pop()

  const property = await loadProperty(id)

  if (!property) {
    return
  }

  try {
    if (!property) {
      return
    }

    const Model = matchModel(property.type)
    const assessment = new Model(property)

    const data = await assessment.processStage(assessment.currentStage)
    console.warn('data');

  } catch (e) {
    
  }
}

await main()
process.exit(0)
