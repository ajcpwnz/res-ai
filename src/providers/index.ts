import type { ProviderConstructor } from 'providers/base'

import { FloodDataProvider } from './floodData'
import { InvestmentSummaryProvider } from './investmentSummary'
import { FinancialProjectionsProvider } from './financialProjections'
import { ExpenseRatioProvider } from './expenseRatio'
import { LocalDataProvider } from './localData'
import { PlacesListProvider } from './placesList'
import { DemographicsProvider } from './demographics'
import { FmrProvider } from './fmr'
import { SalesCompProvider } from './salesComp'
import { MarketDataProvider } from './marketData'
import { AddressLookupProvider } from './addressLookup'

export enum DataSource {
  RentCastAddressLookup = 'RentCastAddressLookup',
  RentCastMarketData = 'RentCastMarketData',
  RentCastSalesComp = 'RentCastSalesComp',
  FloodData = 'FloodData',
  HUDFmr = 'HUDFmr',
  CensusDemographicsReport = 'CensusDemographicsReport',
  GooglePlacesList = 'GooglePlacesList',
  PerplexityLocalData = 'PerplexityLocalData',
  DerivedExpenseRatio = 'DerivedExpenseRatio',
  DerivedFinancialProjections = 'DerivedFinancialProjections',
  DerivedInvestmentSummary = 'DerivedInvestmentSummary',
}

export const providers: Record<DataSource, ProviderConstructor> = {
  [DataSource.RentCastAddressLookup]: AddressLookupProvider,
  [DataSource.RentCastMarketData]: MarketDataProvider,
  [DataSource.RentCastSalesComp]: SalesCompProvider,
  [DataSource.FloodData]: FloodDataProvider,
  [DataSource.HUDFmr]: FmrProvider,
  [DataSource.CensusDemographicsReport]: DemographicsProvider,
  [DataSource.GooglePlacesList]: PlacesListProvider,
  [DataSource.PerplexityLocalData]: LocalDataProvider,
  [DataSource.DerivedExpenseRatio]: ExpenseRatioProvider,
  [DataSource.DerivedFinancialProjections]: FinancialProjectionsProvider,
  [DataSource.DerivedInvestmentSummary]: InvestmentSummaryProvider,
}
