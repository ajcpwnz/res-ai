import PDFDocument from 'pdfkit'
import { BaseProvider } from 'providers/base.ts'
import { PrismaClient } from 'prisma'
import { formatPercents, formatMoney } from 'utils/number.ts'

const prisma = new PrismaClient()

export class MultifamilyInvestmentSummaryProvider {
  constructor(private model: any) {}

  async getData(): Promise<Buffer> {
   const { property } = this.model
    const { meta } = property
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    const endPromise = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => {
        return resolve(Buffer.concat(chunks))
      })
      doc.on('error', (e) => console.error('adsdsadsas', e))
    })

    // Stage 1: Property Overview
    doc.font('Helvetica').fontSize(20).text('Stage 1: Property Overview').moveDown()
    doc.fontSize(8)
    doc.table({
      rowStyles: i => i < 1 ? { border: [0,0,1,0] } : { border: false },
      data: [
        ['Feature','Value'],
        ['Property type', property.type],
        ['Year built', meta.year_built],
        ['Units', meta.unit_count],
        ['Square footage (total)', meta.square_footage],
        ['Lot size (sq ft)', meta.lot_size_sqft],
        ['Flood Zone', meta.flood_zone],
      ],
    })
    doc.moveDown()

    // Stage 2: Financial Details
    doc.fontSize(20).text('Stage 2: Financial Details').moveDown()
    doc.fontSize(8)
    doc.table({
      rowStyles: i => i < 1 ? { border: [0,0,1,0] } : { border: false },
      data: [
        ['Feature','Value'],
        ['Assessed value', formatMoney(meta.assessed_value)],
        ['Annual property taxes', formatMoney(meta.annual_property_tax)],
      ],
    })
    doc.moveDown()

    // Rent Estimates
    doc.fontSize(16).text('Rent Estimates').moveDown()
    doc.fontSize(8)
    doc.table({
      rowStyles: i => i < 1 ? { border: [0,0,1,0] } : { border: false },
      data: [
        ['Metric','Value'],
        ['Average market rent/unit', formatMoney(meta.avg_rent)],
        ['HUD FMR', formatMoney(meta.fmr)],
      ],
    })
    doc.moveDown()

    // Sales Comparables
    const rentComps = await prisma.lookupResult.findMany({ where: { propertyId: property.id, resultType: 'sales_comp' } })
    const comps = rentComps.map(r => JSON.parse(r.json))
    doc.fontSize(16).text('Sales Comparables').moveDown()
    doc.fontSize(8)
    doc.table({
      columnStyles: [200, '*', '*', '*', '*', '*', '*'],
      rowStyles: i => i < 1 ? { border: [0,0,1,0] } : { border: false },
      data: [
        ['Address','Price','Beds','Baths','Sq Ft','Sold date','Distance'],
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

    // Demographics
    const demographicsRecord = await prisma.lookupResult.findFirst({ where: { propertyId: property.id, resultType: 'demographics_data' } })
    const demographicsData = JSON.parse(demographicsRecord?.json || '{}')
    doc.fontSize(16).text('Demographics').moveDown()
    doc.fontSize(8)
    doc.table({
      columnStyles: [200, '*'],
      rowStyles: i => i < 1 ? { border: [0,0,1,0] } : { border: false },
      data: [
        ['Metric','Value'],
        ['Median Household Income', formatMoney(demographicsData.medianIncome)],
        ['Population (Est.)', demographicsData.totalPopulation],
        ['Race Breakdown:',''],
        ['- Black African American', formatPercents(demographicsData.blackPopulation, demographicsData.totalPopulation)],
        ['- White (Non-Hispanic)', formatPercents(demographicsData.whitePopulation, demographicsData.totalPopulation)],
        ['- Hispanic/Latino', formatPercents(demographicsData.latinoPopulation, demographicsData.totalPopulation)],
        ['Owner-Occupied Housing', formatPercents(demographicsData.housingUnits - demographicsData.renterUnits, demographicsData.housingUnits)],
        ['Renter-Occupied', formatPercents(demographicsData.renterUnits, demographicsData.housingUnits)],
      ],
    })
    doc.moveDown()

    // Institutional Anchors
    const relatedPlaces = await prisma.lookupResult.findMany({ where: { propertyId: property.id, resultType: 'related_place' }, take: 6 })
    const places = relatedPlaces.map(r => JSON.parse(r.json))
    doc.fontSize(16).text('Institutional Anchors').moveDown()
    doc.fontSize(8)
    doc.table({
      columnStyles: [120, 270, 45, '*'],
      rowStyles: i => i < 1 ? { border: [0,0,1,0] } : { border: false },
      data: [
        ['Type','Name','Distance','Size'],
        ...places.map(r => [
          r.type,
          `${r.name.text}\n${r.formattedAddress}\n${r.info}`,
          r.distance.toFixed(2),
          r.size,
        ]),
      ],
    })
    doc.moveDown()

    // Financial Trends
    const localDataRecord = await prisma.lookupResult.findFirst({ where: { propertyId: property.id, resultType: 'local_data' } })
    const localData = JSON.parse(localDataRecord?.json || '{}')
    doc.fontSize(16).text('Financial Trends').moveDown()
    doc.fontSize(8).text(localData.economicDevelopment || 'N/A').moveDown(2)

    // Stage 3: Underwriting Assumptions
    doc.fontSize(20).text('Stage 3: Underwriting Assumptions').moveDown()
    doc.fontSize(8)
    doc.text(`Vacancy rate: ${formatPercents(meta.vacancy)}`)
    doc.text(`Expense ratio: ${formatPercents(meta.expense_rate)} (${meta.expense_rate_type})`)
    doc.text(`Renovation scope: ${meta.renovation_scope}`)
    doc.text(`Renovation cost: ${formatMoney(meta.renovation_cost)}`).moveDown()

    // Stage 4A: NOI Projections
    const projRecord = await prisma.lookupResult.findFirst({ where: { propertyId: property.id, resultType: 'financial_projection' } })
    const { projections, exit_scenarios, offer_price } = JSON.parse(projRecord?.json || '{}')
    doc.fontSize(20).text('Stage 4A: NOI Projections').moveDown()
    doc.fontSize(8)
    doc.table({
      columnStyles: ['*','*','*','*'],
      rowStyles: i => i < 1 ? { border: [0,0,1,0] } : { border: false },
      data: [
        ['Year','EGI','Expenses','NOI'],
        ...projections.map(p => [
          p.year,
          formatMoney(p.EGI),
          formatMoney(p.expenses),
          formatMoney(p.NOI),
        ]),
      ],
    })
    doc.moveDown()

    // Stage 4B: Exit & ARR Scenarios
    doc.fontSize(20).text('Stage 4B: Exit & ARR Scenarios').moveDown()
    doc.fontSize(8)
    doc.table({
      columnStyles: ['*','*','*','*','*'],
      rowStyles: i => i < 1 ? { border: [0,0,1,0] } : { border: false },
      data: [
        ['Scenario','Year','Exit Value','Net Proceeds','ARR'],
        ...exit_scenarios.map(e => [
          e.rate,
          e.year,
          formatMoney(e.exitValue),
          formatMoney(e.netProceeds),
          formatPercents(e.ARR),
        ]),
      ],
    })
    doc.moveDown()

    // Stage 4C: Offer Price
    doc.fontSize(20).text('Stage 4C: Offer Price').moveDown()
    doc.fontSize(8)
    doc.table({
      columnStyles: [300,'*'],
      rowStyles: i => i < 1 ? { border: [0,0,1,0] } : { border: false },
      data: [
        ['Metric','Value'],
        ['Offer Price', formatMoney(offer_price)],
      ],
    })

    doc.end()
    return endPromise
  }
}
