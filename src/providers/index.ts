import type { ProviderConstructor } from 'providers/base'
import { MultifamilyExpenseRatioProvider } from 'providers/multifamilyExpenseRatio'
import { MultifamilyFinancialProjectionsProvider } from 'providers/multifamilyFinancialProjections'
import { MultifamilyInvestmentSummaryProvider } from 'providers/multifamilyInvestmentSummary'
import { ResidentialExpenseRatioProvider } from 'providers/residentialExpenseRatio'
import { FinancialProjectionsProvider } from 'providers/residentialFinancialProjections'
import { ResidentialInvestmentSummaryProvider } from 'providers/residentialInvestmentSummary'

import { FloodDataProvider } from './floodData'
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
  DerivedResidentialExpenseRatio = 'DerivedResidentialExpenseRatio',
  DerivedMultifamilyExpenseRatio = 'DerivedMultifamilyExpenseRatio',
  DerivedResidentialFinancialProjections = 'DerivedResidentialFinancialProjections',
  DerivedMultifamilyFinancialProjections = 'DerivedMultifamilyFinancialProjections',
  DerivedResidentialInvestmentSummary = 'DerivedResidentialInvestmentSummary',
  DerivedMultifamilyInvestmentSummary = 'DerivedMultifamilyInvestmentSummary',
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
  [DataSource.DerivedResidentialExpenseRatio]: ResidentialExpenseRatioProvider,
  [DataSource.DerivedMultifamilyExpenseRatio]: MultifamilyExpenseRatioProvider,
  [DataSource.DerivedResidentialFinancialProjections]: FinancialProjectionsProvider,
  [DataSource.DerivedMultifamilyFinancialProjections]: MultifamilyFinancialProjectionsProvider,
  [DataSource.DerivedResidentialInvestmentSummary]: ResidentialInvestmentSummaryProvider,
  [DataSource.DerivedMultifamilyInvestmentSummary]: MultifamilyInvestmentSummaryProvider,
}
