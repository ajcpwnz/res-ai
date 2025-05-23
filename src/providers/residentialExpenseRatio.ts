import { BaseProvider } from 'providers/base'
import { RenovationScope } from 'providers/types'
import { createPropertyMeta } from 'utils/db'
import { formatPercents } from 'utils/number.ts'

const rentRates = {
  single: [
    { from: 0, to: 1980, defaultRate: 0.45, rateRange: { from: 0.4, to: 0.45 }, yearLabel: 'built before 1980' },
    { from: 1980, to: 2010, defaultRate: 0.4, rateRange: { from: 0.35, to: 0.4 }, yearLabel: 'built between 1980 and 2010' },
    { from: 2010, to: 3000, defaultRate: 0.35, rateRange: { from: 0.3, to: 0.35 }, yearLabel: 'built after 2010' }  // oh no it will break in year 3K
  ],
  multi: [
    { from: 0, to: 1980, defaultRate: 0.5, rateRange: { from: 0.45, to: 0.5 }, yearLabel: 'built before 1980' },
    { from: 1980, to: 2010, defaultRate: 0.45, rateRange: { from: 0.4, to: 0.45 }, yearLabel: 'built between 1980 and 2010' },
    { from: 2010, to: 3000, defaultRate: 0.4, rateRange: { from: 0.35, to: 0.4 },  yearLabel: 'built after 2010' }
  ]
}

const renovationRates: Record<RenovationScope, number> = {
  [RenovationScope.light]: 7000,
  [RenovationScope.medium]: 12000,
  [RenovationScope.heavy]: 17000
}

export class ExpenseRatioProvider extends BaseProvider {
  getData = async () => {
    const { property } = this.model
    const { meta } = property

    const { bedrooms, year_built } = meta;

    const rateList = bedrooms === 1 ? rentRates.single : rentRates.multi

    const rate = rateList.find(row => row.from <= year_built && row.to > year_built)!;

    const metas: Record<string, any> = {
      expense_rate: rate?.defaultRate,
      expense_rate_type: `${bedrooms === 1 ? 'SFH' : 'MFH'}, ${rate?.yearLabel} (${formatPercents(rate.rateRange.from)}-${formatPercents(rate.rateRange.to)})`,
      vacancy: 0.1,
      renovation_scope: RenovationScope.light,
      renovation_cost: renovationRates[RenovationScope.light],
    }

    console.warn('expense rate inputs', metas)

    for (const [key, value] of Object.entries(metas)) {
      if (!value) continue

      await createPropertyMeta(property.id, key, value)
    }
  }
}
