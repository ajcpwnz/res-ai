import type { DataProvider } from './index'

export class FinancialProjectionsProvider implements DataProvider {
  getData = async () => {
    console.warn('getting financial projections');
  }
}
