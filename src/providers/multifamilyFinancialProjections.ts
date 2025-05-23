import { BaseProvider } from 'providers/base.ts'
import { saveLookupResults } from 'utils/db.ts'

const MONTHS = 12

export class MultifamilyFinancialProjectionsProvider extends BaseProvider {
  private getNOIValues = (rent_price: number) => {
    const { meta } = this.model.property

    const EGI = rent_price * MONTHS * (1 - meta.vacancy)
    const expenses = EGI * meta.expense_rate
    const NOI = EGI - expenses

    return { EGI, expenses, NOI }
  }

  getData = async () => {
    const { property } = this.model
    const address = property.address.fullAddress
    const { meta } = property

    const baseNOI = this.getNOIValues(meta.avg_rent)
    const projections: Array<{ year: number; EGI: number; expenses: number; NOI: number }> = []
    for (let year = 1; year <= 5; year++) {
      const prev = projections[projections.length - 1] ?? baseNOI;

      projections.push({
        year,
        EGI:      baseNOI.EGI,
        expenses: prev.expenses * (1 + Number(meta.expense_growth)),
        NOI:      prev.NOI      * (1 + Number( meta.income_growth)),
      })
    }

    const baseCap = baseNOI.NOI / meta.assessed_value

    const stressTestScenarios: Record<string, number> = {
      stress: baseCap - 0.0025,
      base:   baseCap,
      upside: baseCap + 0.0025,
    }
    const exitYears = [3, 5]

    const renovationRate = meta.renovation_cost * meta.unit_count;
    const offer_price = (meta.assessed_value * 0.75) - renovationRate;

    const downPayment    = offer_price * 0.3
    const loanPayoff     = offer_price * 0.7

    const equityInvested = downPayment + renovationRate;

    const exit_scenarios: Array<{
      rate: string;
      year: number;
      exitValue: number;
      netProceeds: number;
      equity: number;
      ARR: number;
    }> = [];



    for (const [label, cap] of Object.entries(stressTestScenarios)) {
      for (const year of exitYears) {
        const { NOI } = projections.find(p => p.year === year)!
        const exitValue   = NOI / cap
        const netProceeds = exitValue - loanPayoff
        const totalGain   = netProceeds - equityInvested
        const ARR         = totalGain / equityInvested / year

        exit_scenarios.push({
          rate:       label,
          year,
          exitValue,
          netProceeds,
          equity:     equityInvested,
          ARR,
        })
      }
    }

    const projection = {
      projections,
      exit_scenarios,
      offer_price,
    }

    await saveLookupResults(property.id, 'financial_projection', [projection], address)

    return {
      financial_projection: projection
    }
  }
}
