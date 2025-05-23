// providers/ResidentialInvestmentSummaryProvider.ts
import PDFDocument from 'pdfkit'
import { PrismaClient } from 'prisma'
import { formatPercents, formatMoney } from 'utils/number.ts'

const prisma = new PrismaClient()

export class ResidentialInvestmentSummaryProvider {
  constructor(private model: any) {}

  async getData(): Promise<Buffer> {
    const { property } = this.model
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    const endPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)
    })

    doc.font('Helvetica')
    doc.fontSize(20).text('Stage 1').moveDown()
    doc.fontSize(16).text('Physical Characteristics').moveDown()
    doc.fontSize(8)
    doc.table({
      rowStyles: i => i < 1 ? { border: [0, 0, 1, 0] } : { border: false },
      data: [
        ['Feature', 'Value'],
        ['Property type', property.type],
        ['Year built', property.meta.year_built],
        ['Square footage', property.meta.square_footage],
        ['Lot size (square ft.)', property.meta.lot_size_sqft],
        ['Bedrooms', property.meta.bedrooms],
        ['Bathrooms', property.meta.bathrooms],
        ['Flood Zone', property.meta.flood_zone],
      ],
    })
    doc.moveDown()
    doc.fontSize(16).text('Financial Details').moveDown()
    doc.fontSize(8)
    doc.table({
      rowStyles: i => i < 1 ? { border: [0, 0, 1, 0] } : { border: false },
      data: [
        ['Feature', 'Value'],
        ['Assessed value', formatMoney(property.meta.assessed_value)],
        ['Annual property taxes', formatMoney(property.meta.annual_property_tax)],
        ['AVM value', formatMoney(property.meta.avm_value)],
      ],
    })
    doc.moveDown()
    doc.fontSize(20).text('Stage 2').moveDown()
    doc.fontSize(16).text('Rent Estimates').moveDown()
    doc.fontSize(8)
    doc.table({
      rowStyles: i => i < 1 ? { border: [0, 0, 1, 0] } : { border: false },
      data: [
        ['Feature', 'Value'],
        ['Market rent (based on comps)', formatMoney(property.meta.avg_rent)],
        ['HUD FMR', formatMoney(property.meta.fmr)],
      ],
    })
    doc.moveDown()
    const rentComps = await prisma.lookupResult.findMany({
      where: { propertyId: property.id, resultType: 'sales_comp' },
    })
    const comps = rentComps.map(r => JSON.parse(r.json))
    doc.fontSize(16).text('Sales Comparables')
    doc.fontSize(8)
    doc.table({
      columnStyles: [200, '*', '*', '*', '*', '*', '*', '*'],
      rowStyles: i => i < 1 ? { border: [0, 0, 1, 0] } : { border: false },
      data: [
        ['Address', 'Price', 'Beds', 'Baths', 'Sq Ft', 'Sold date', 'Distance'],
        ...comps.map(r => [
          r.formattedAddress,
          formatMoney(r.price),
          r.bedrooms,
          r.bathrooms,
          r.squareFootage,
          r.listedDate,
          r.distance.toFixed(2),
        ]),
      ],
    })
    doc.moveDown()
    const demographicsRecord = await prisma.lookupResult.findFirst({
      where: { propertyId: property.id, resultType: 'demographics_data' },
    })
    const demographicsData = JSON.parse(demographicsRecord?.json || '{}')
    doc.fontSize(16).text('Demographics')
    doc.fontSize(8)
    doc.table({
      columnStyles: [200, '*'],
      rowStyles: i => i < 1 ? { border: [0, 0, 1, 0] } : { border: false },
      data: [
        ['Metric', 'Value'],
        ['Median Household Income', formatMoney(demographicsData.medianIncome)],
        ['Population (Est.)', demographicsData.totalPopulation],
        ['Race Breakdown:', ''],
        ['- Black African American', formatPercents(demographicsData.blackPopulation, demographicsData.totalPopulation)],
        ['- White (Non-Hispanic)', formatPercents(demographicsData.whitePopulation, demographicsData.totalPopulation)],
        ['- Hispanic/Latino', formatPercents(demographicsData.latinoPopulation, demographicsData.totalPopulation)],
        ['Owner-Occupied Housing', formatPercents(demographicsData.housingUnits - demographicsData.renterUnits, demographicsData.housingUnits)],
        ['Renter-Occupied', formatPercents(demographicsData.renterUnits, demographicsData.housingUnits)],
      ],
    })
    doc.moveDown()
    const relatedPlaces = await prisma.lookupResult.findMany({
      where: { propertyId: property.id, resultType: 'related_place' },
      take: 6,
    })
    const places = relatedPlaces.map(r => JSON.parse(r.json))
    doc.fontSize(16).text('Institutional Anchors')
    doc.fontSize(8)
    doc.table({
      columnStyles: [120, 270, 45, '*'],
      rowStyles: i => i < 1 ? { border: [0, 0, 1, 0] } : { border: false },
      data: [
        ['Type', 'Name', 'Distance', 'Size'],
        ...places.map(r => [
          r.type,
          `${r.name.text}\n${r.formattedAddress}\n${r.info}`,
          r.distance.toFixed(2),
          r.size,
        ]),
      ],
    })
    doc.moveDown()
    const localDataRecord = await prisma.lookupResult.findFirst({
      where: { propertyId: property.id, resultType: 'local_data' },
    })
    const localData = JSON.parse(localDataRecord?.json || '{}')
    doc.fontSize(16).text('Financial trends')
    doc.fontSize(8).text(localData.economicDevelopment || 'N/A').moveDown(2)
    doc.fontSize(20).text('Stage 3: Underwriting Assumptions Summary')
    doc.fontSize(8).text(`Property: ${property.address.fullAddress}`)
    doc.fontSize(8).text(`Type: ${property.type} | Year Built: ${property.meta.year_built} | Sq. Ft. ${property.meta.square_footage}`).moveDown()
    doc.fontSize(16).text('Income Assumptions')
    doc.fontSize(8).text(`Market rent: ${formatMoney(property.meta.avg_rent)}`)
    doc.fontSize(8).text(`HUD Rent: ${formatMoney(property.meta.fmr)}`)
    doc.fontSize(8).text(`Vacancy rate: ${formatPercents(property.meta.vacancy)}`).moveDown(2)
    doc.fontSize(16).text('Expense Assumptions')
    doc.fontSize(8).text(`Expense Ratio Range: ${property.meta.expense_rate_type}`)
    doc.fontSize(8).text(`Used: ${formatPercents(property.meta.expense_rate)}`).moveDown(2)
    doc.fontSize(16).text('Renovation')
    doc.fontSize(8).text(`Scope: ${property.meta.renovation_scope}`)
    doc.fontSize(8).text(`Estimated cost: ${formatMoney(property.meta.renovation_cost)}`).moveDown(2)
    doc.fontSize(20).text('Stage 4: Stabilized NOI & Offer Price').moveDown()
    const projectionRecord = await prisma.lookupResult.findFirst({
      where: { propertyId: property.id, resultType: 'financial_projection' },
    })
    const financialProjection = JSON.parse(projectionRecord?.json || '{}')
    doc.fontSize(16).text('Income, Expenses & NOI Summary')
    doc.fontSize(8)
    doc.table({
      columnStyles: ['*', '*', '*', '*', '*'],
      rowStyles: i => i < 1 ? { border: [0, 0, 1, 0] } : { border: false },
      data: [
        ['Scenario', 'Rent/mo', 'EGI', `Expenses (${formatPercents(property.meta.expense_rate)})`, 'NOI'],
        ['Market', formatMoney(property.meta.avg_rent), formatMoney(financialProjection.marketNOI.EGI), formatMoney(financialProjection.marketNOI.expenses), formatMoney(financialProjection.marketNOI.NOI)],
        ['HUD', formatMoney(property.meta.fmr), formatMoney(financialProjection.fmrNOI.EGI), formatMoney(financialProjection.fmrNOI.expenses), formatMoney(financialProjection.fmrNOI.NOI)],
      ],
    })
    doc.moveDown()
    doc.fontSize(16).text('ARV & Offer Price')
    doc.fontSize(8)
    doc.table({
      columnStyles: [270, '*'],
      rowStyles: i => i < 1 ? { border: [0, 0, 1, 0] } : { border: false },
      data: [
        ['Metric', 'Value'],
        [`ARV $${financialProjection.pricePerFoot} * ${property.meta.square_footage}`, formatMoney(financialProjection.ARV)],
        [`Offer value (ARV × 0.75) - $${property.meta.renovation_cost}`, formatMoney(financialProjection.offer_price)],
      ],
    })
    doc.moveDown()
    doc.end()

    return endPromise
  }
}
