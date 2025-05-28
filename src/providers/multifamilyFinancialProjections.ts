import { BaseProvider } from 'providers/base.ts'
import { saveLookupResults } from 'utils/db.ts'

const MONTHS = 12

type NOIValues = { EGI: number; expenses: number; NOI: number }

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
    const { meta, units } = property

    console.warn('dd', units)
    const combined = units.reduce(
      (acc: NOIValues, unit: { quantity: number; rent_avm: number }) => {
        const { EGI, expenses, NOI } = this.getNOIValues(unit.rent_avm)
        console.warn('dddddd', unit, EGI, expenses, NOI);

        return {
          EGI: acc.EGI + EGI * unit.quantity,
          expenses: acc.expenses + expenses * unit.quantity,
          NOI: acc.NOI + NOI * unit.quantity,
        }
      },
      { EGI: 0, expenses: 0, NOI: 0 }
    )

    const projections: Array<{ year: number; EGI: number; expenses: number; NOI: number }> = []
    for (let year = 1; year <= 5; year++) {
      const prev = projections[projections.length - 1] ?? combined
      projections.push({
        year,
        EGI: combined.EGI,
        expenses: prev.expenses * (1 + Number(meta.expense_growth)),
        NOI: prev.NOI * (1 + Number(meta.income_growth)),
      })
    }

    // Base capitalization rate
    const baseCap = combined.NOI / meta.assessed_value

    // Stress test scenarios
    const stressTestScenarios: Record<string, number> = {
      stress: baseCap - 0.0025,
      base: baseCap,
      upside: baseCap + 0.0025,
    }
    const exitYears = [3, 5]

    // Purchase calculations
    const totalUnits = units.reduce((sum, u) => sum + u.quantity, 0);
    const renovationRate = meta.renovation_cost * totalUnits
    const offer_price = meta.assessed_value * 0.75 - renovationRate
    const downPayment = offer_price * 0.3
    const loanPayoff = offer_price * 0.7
    const equityInvested = downPayment + renovationRate

    // Exit scenarios
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
        const exitValue = NOI / cap
        const netProceeds = exitValue - loanPayoff
        const totalGain = netProceeds - equityInvested
        const ARR = totalGain / equityInvested / year

        exit_scenarios.push({
          rate: label,
          year,
          exitValue,
          netProceeds,
          equity: equityInvested,
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
