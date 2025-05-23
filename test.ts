import { loadProperty } from 'utils/db.ts'
import { models } from './src/models'
import dotenv from "dotenv";

dotenv.config();

const main = async () => {
  const id = [...Bun.argv].pop();

  const property = await loadProperty(id);

  if(!property) {
    return;
  }

  const Model = models[property.type]

  if (!Model) {
    return
  }

  const assesment = new Model(property);

  await assesment.prepare()

  while (!assesment.done) {
    await assesment.processStage(assesment.currentStage);
    await assesment.reload();
  }

}

await main()
process.exit(0)
