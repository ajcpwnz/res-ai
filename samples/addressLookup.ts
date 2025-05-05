const addressLookupSample = {
  id: "746-David-St,-Memphis,-TN-38114",
  formattedAddress: "746 David St, Memphis, TN 38114",
  addressLine1: "746 David St",
  addressLine2: null,
  city: "Memphis",
  state: "TN",
  zipCode: "38114",
  county: "Shelby",
  latitude: 35.111788,
  longitude: -89.974233,
  propertyType: "Single Family",
  bedrooms: 3,
  bathrooms: 1,
  squareFootage: 1014,
  lotSize: 8538,
  yearBuilt: 1955,
  assessorID: "029-095- - -00027",
  legalDescription: "ES DAVID",
  subdivision: "MONTGOMERY PARK PL",
  zoning: "RU-1",
  features: {
    architectureType: "Cottage",
    cooling: true,
    coolingType: "Commercial",
    exteriorType: "Brick Veneer",
    fireplace: true,
    fireplaceType: "Single",
    floorCount: 1,
    foundationType: "Raised",
    garage: true,
    garageType: "Carport",
    heating: true,
    heatingType: "Forced Air",
    roofType: "Composition Shingle",
    roomCount: 6,
    unitCount: 1,
  },
  taxAssessments: {
    "2023": {
      year: 2023,
      value: 6525,
      land: 750,
      improvements: 5775,
    },
    "2024": {
      year: 2024,
      value: 6525,
      land: 750,
      improvements: 5775,
    },
  },
  propertyTaxes: {
    "2022": {
      year: 2022,
      total: 397,
    },
    "2023": {
      year: 2023,
      total: 397,
    },
  },
  owner: {
    names: [ "Lawrence E Garrison" ],
    type: "Individual",
    mailingAddress: {
      id: "746-David-St,-Memphis,-TN-38114",
      formattedAddress: "746 David St, Memphis, TN 38114",
      addressLine1: "746 David St",
      addressLine2: null,
      city: "Memphis",
      state: "TN",
      zipCode: "38114",
    },
  },
  ownerOccupied: true,
}

export interface AddressLookupResult {
  id: string
  formattedAddress: string
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  zipCode: string
  county: string
  latitude: number
  longitude: number
  propertyType: string
  bedrooms: number
  bathrooms: number
  squareFootage: number
  lotSize: number
  yearBuilt: number
  assessorID: string
  legalDescription: string
  subdivision: string
  zoning: string
  features: Features
  taxAssessments: Record<string, TaxAssessment>
  propertyTaxes: Record<string, PropertyTax>
  owner: Owner
  ownerOccupied: boolean
}

export interface Features {
  architectureType: string
  cooling: boolean
  coolingType: string
  exteriorType: string
  fireplace: boolean
  fireplaceType: string
  floorCount: number
  foundationType: string
  garage: boolean
  garageType: string
  heating: boolean
  heatingType: string
  roofType: string
  roomCount: number
  unitCount: number
}

export interface TaxAssessment {
  year: number
  value: number
  land: number
  improvements: number
}

export interface PropertyTax {
  year: number
  total: number
}

export interface MailingAddress {
  id: string
  formattedAddress: string
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  zipCode: string
}

export interface Owner {
  names: string[]
  type: string
  mailingAddress: MailingAddress
}
