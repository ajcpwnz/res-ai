import type { DataProvider } from './index'

export class ExpenseRatioProvider implements DataProvider {
  getData = async () => {
    console.warn('getting expense ratio data');
  }
}
