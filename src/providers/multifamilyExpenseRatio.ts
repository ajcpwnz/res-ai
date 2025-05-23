import { BaseProvider } from 'providers/base'
import { RenovationScope } from 'providers/types'
import { createPropertyMeta } from 'utils/db'
import { formatPercents } from 'utils/number.ts'

const rentRates = [
  {
    from: 0,
    to: 1985,
    unitsRange: { from: 0, to: 50 },
    defaultRate: 0.55,
    yearLabel: 'built before 1985, less than 50 units'
  },
  {
    from: 0,
    to: 1985,
    unitsRange: { from: 50, to: Number.MAX_SAFE_INTEGER },
    defaultRate: 0.5,
    yearLabel: 'built before 1985, more than 50 units'
  },
  {
    from: 1985,
    to: 3000,
    unitsRange: { from: 0, to: 50 },
    defaultRate: 0.5,
    yearLabel: 'built after 1985, less than 50 units'
  },
  {
    from: 1985,
    to: 3000,
    unitsRange: { from: 50, to: Number.MAX_SAFE_INTEGER },
    defaultRate: 0.45,
    yearLabel: 'built after 1985, more than 50 units'
  },
]


const renovationRates: Record<RenovationScope, number> = {
  [RenovationScope.light]: 7000,
  [RenovationScope.medium]: 12000,
  [RenovationScope.heavy]: 17000
}

export class MultifamilyExpenseRatioProvider extends BaseProvider {
  getData = async () => {
    const { property } = this.model
    const { meta } = property

    const { year_built, unit_count } = meta

    const rate = rentRates.find(row => (row.from <= year_built && row.to > year_built) && (row.unitsRange.from <= unit_count && row.unitsRange.to > unit_count))!

    const metas: Record<string, any> = {
      expense_rate:           rate.defaultRate,
      expense_rate_type:      `${rate.yearLabel} (${formatPercents(rate.defaultRate)})`,
      income_growth:          0.03,
      expense_growth:         0.03,
      renovation_scope: RenovationScope.light,
      renovation_cost: renovationRates[RenovationScope.light],
      renovation_units_per_month:  3,
    }

    for (const [key, value] of Object.entries(metas)) {
      if (!value) continue

      await createPropertyMeta(property.id, key, value)
    }

    return {
      ...metas,
      avg_rent: meta.avg_rent,
      vacancy: meta.vacancy,
    }
  }
}
