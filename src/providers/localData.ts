import type { DataProvider } from './index'

export class LocalDataProvider implements DataProvider {
  getData = async () => {
    console.warn('getting local data');
  }
}
