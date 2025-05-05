import type { DataProvider } from './index'

export class InvestmentSummaryProvider implements DataProvider {
  getData = async () => {
    console.warn('preparing investment summary');
  }
}
