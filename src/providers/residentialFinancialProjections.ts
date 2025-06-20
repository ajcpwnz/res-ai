import { BaseProvider } from 'providers/base'
import { prisma, saveLookupResults } from 'utils/db'

const MONTHS = 12

export class FinancialProjectionsProvider extends BaseProvider {

  private getNOIValues = (rent_price: number) => {
    const { meta } = this.model.property

    const EGI = (rent_price * MONTHS) * (1 - meta.vacancy)
    const expenses = EGI * meta.expense_rate
    const NOI = EGI - expenses

    return {
      EGI,
      expenses,
      NOI
    }
  }

  getData = async () => {
    const { property } = this.model;
    const address = property.address.fullAddress;

    const { meta } = property

    const saleComps = await prisma.lookupResult.findMany({
      where: {
        propertyId: property.id,
        resultType: 'sales_comp',
      }
    })

    const comps = saleComps.map(row => JSON.parse(row.json))

    let compCount = 0
    let total = 0

    for (const comp of comps) {
      if(comp.squareFootage) {
        total += comp.price / comp.squareFootage
        compCount += 1
      }
    }

    const pricePerFoot = total / compCount

    const rentData = [];

    for (const unit of property.units) {
      const marketNOI = this.getNOIValues(unit.rent_avm)
      const fmrNOI = this.getNOIValues(unit.fmr)

      rentData.push({
        unit,
        marketNOI,
        fmrNOI,
      })
    }

    const ARV = pricePerFoot * meta.square_footage;

    const renovationRate = Number(meta.renovation_cost);
    const offer_price = (ARV * 0.75) - renovationRate

    const projection = {
      pricePerFoot,
      rentData,
      ARV,
      offer_price,
    }

    console.warn('financial projections', projection);

    await saveLookupResults(property.id, 'financial_projection', [projection], address);

    return {
      financial_projection: projection
    }
  }
}
