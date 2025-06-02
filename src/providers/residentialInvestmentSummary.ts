import PDFDocument from 'pdfkit'
import { prisma } from 'utils/db.ts'
import { formatPercents, formatMoney } from 'utils/number.ts'


const MONTHS = 12;

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

    // Stage 1: Physical Characteristics
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
        ['Lot size (sq ft)', property.meta.lot_size_sqft],
        ['Bedrooms', property.meta.bedrooms],
        ['Bathrooms', property.meta.bathrooms],
        ['Flood Zone', property.meta.flood_zone],
      ],
    })
    doc.moveDown()

    // Stage 2: Rent Estimates per Unit Type
    doc.fontSize(20).text('Stage 2').moveDown()
    doc.fontSize(16).text('Rent Estimates').moveDown()
    doc.fontSize(8)
    const rentData = await prisma.lookupResult.findFirst({
      where: { propertyId: property.id, resultType: 'financial_projection' },
    }).then(r => JSON.parse(r?.json || '{}')).then(fp => fp.rentData || [])

    doc.table({
      columnStyles: { 0: { width: 100 }, 1: { width: 100 }, 2: { width: 100 } },
      rowStyles: i => i < 1 ? { border: [0, 0, 1, 0] } : { border: false },
      data: [
        ['Unit Type', 'Market rent/mo', 'HUD FMR/mo'],
        ...rentData.map((rd: any) => [
          `${rd.unit.quantity}×${rd.unit.bedrooms}BR, ${rd.unit.bathrooms}BA`,
          formatMoney(rd.marketNOI ? (rd.marketNOI.EGI / MONTHS / rd.unit.quantity) : 0),
          formatMoney(rd.fmrNOI ? (rd.fmrNOI.EGI / MONTHS / rd.unit.quantity) : 0),
        ]),
      ],
    })
    doc.moveDown()

    // Sales Comparables
    doc.fontSize(16).text('Sales Comparables').moveDown()
    const saleComps = await prisma.lookupResult.findMany({
      where: { propertyId: property.id, resultType: 'sales_comp' },
    })
    const comps = saleComps.map(r => JSON.parse(r.json))
    doc.fontSize(8)
    doc.table({
      columnStyles: [150, 80, 40, 40, 50, 60, 40],
      rowStyles: i => i < 1 ? { border: [0, 0, 1, 0] } : { border: false },
      data: [
        ['Address', 'Price', 'Beds', 'Baths', 'Sq Ft', 'Sold date', 'Distance'],
        ...comps.map((r: any) => [
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
    doc.fontSize(16).text('Demographics').moveDown()
    const demographicsRecord = await prisma.lookupResult.findFirst({
      where: { propertyId: property.id, resultType: 'demographics_data' },
    })
    const demographicsData = JSON.parse(demographicsRecord?.json || '{}')
    doc.fontSize(8)
    doc.table({
      columnStyles: { 0: 150, 1: 300 },
      rowStyles: i => i < 1 ? { border: [0, 0, 1, 0] } : { border: false },
      data: [
        ['Metric', 'Value'],
        ['Median Household Income', formatMoney(demographicsData.medianIncome)],
        ['Population (Est.)', demographicsData.totalPopulation],
        ['Black or African American (%)', formatPercents(demographicsData.blackPopulation, demographicsData.totalPopulation)],
        ['White (Non-Hispanic) (%)', formatPercents(demographicsData.whitePopulation, demographicsData.totalPopulation)],
        ['Hispanic/Latino (%)', formatPercents(demographicsData.latinoPopulation, demographicsData.totalPopulation)],
        ['Owner-Occupied (%)', formatPercents(demographicsData.housingUnits - demographicsData.renterUnits, demographicsData.housingUnits)],
        ['Renter-Occupied (%)', formatPercents(demographicsData.renterUnits, demographicsData.housingUnits)],
      ],
    })
    doc.moveDown()

    // Related Places
    doc.fontSize(16).text('Institutional Anchors').moveDown()
    const relatedPlaces = await prisma.lookupResult.findMany({
      where: { propertyId: property.id, resultType: 'related_place' },
      take: 6,
    })
    const places = relatedPlaces.map(r => JSON.parse(r.json))
    doc.fontSize(8)
    doc.table({
      columnStyles: [80, 200, 50, 50],
      rowStyles: i => i < 1 ? { border: [0, 0, 1, 0] } : { border: false },
      data: [
        ['Type', 'Name & Address', 'Distance', 'Size'],
        ...places.map((r: any) => [
          r.type,
          `${r.name.text}\n${r.formattedAddress}\n${r.info}`,
          r.distance.toFixed(2),
          r.size,
        ]),
      ],
    })
    doc.moveDown()

    // Local Data Trends
    doc.fontSize(16).text('Financial Trends').moveDown()
    const localDataRecord = await prisma.lookupResult.findFirst({
      where: { propertyId: property.id, resultType: 'local_data' },
    })
    const localData = JSON.parse(localDataRecord?.json || '{}')
    doc.fontSize(8).text(localData.economicDevelopment || 'N/A').moveDown(2)

    // Stage 4: Summary of Income & Offer Price
    doc.fontSize(20).text('Stage 4: Income & Offer Price').moveDown()
    const projectionRecord = await prisma.lookupResult.findFirst({
      where: { propertyId: property.id, resultType: 'financial_projection' },
    })
    const financialProjection = JSON.parse(projectionRecord?.json || '{}')

    // Market NOI by unit
    doc.fontSize(16).text('Market Scenario: Income, Expenses & NOI').moveDown()
    doc.fontSize(8)
    doc.table({
      columnStyles: { 0: 100, 1: 80, 2: 80, 3: 80, 4: 80 },
      rowStyles: i => i < 1 ? { border: [0, 0, 1, 0] } : { border: false },
      data: [
        ['Unit Type', 'Rent/mo', 'EGI', `Expenses (${formatPercents(property.meta.expense_rate)})`, 'NOI'],
        ...financialProjection.rentData.map((rd: any) => [
          `${rd.unit.quantity}×${rd.unit.bedrooms}BR`,
          formatMoney(rd.marketNOI.EGI / MONTHS / rd.unit.quantity),
          formatMoney(rd.marketNOI.EGI),
          formatMoney(rd.marketNOI.expenses),
          formatMoney(rd.marketNOI.NOI),
        ]),
      ],
    })
    doc.moveDown()

    // HUD/FMR NOI by unit
    doc.fontSize(16).text('HUD Scenario: Income, Expenses & NOI').moveDown()
    doc.fontSize(8)
    doc.table({
      columnStyles: { 0: 100, 1: 80, 2: 80, 3: 80, 4: 80 },
      rowStyles: i => i < 1 ? { border: [0, 0, 1, 0] } : { border: false },
      data: [
        ['Unit Type', 'Rent/mo', 'EGI', `Expenses (${formatPercents(property.meta.expense_rate)})`, 'NOI'],
        ...financialProjection.rentData.map((rd: any) => [
          `${rd.unit.quantity}×${rd.unit.bedrooms}BR`,
          formatMoney(rd.fmrNOI.EGI / MONTHS / rd.unit.quantity),
          formatMoney(rd.fmrNOI.EGI),
          formatMoney(rd.fmrNOI.expenses),
          formatMoney(rd.fmrNOI.NOI),
        ]),
      ],
    })
    doc.moveDown()

    // ARV & Offer Price
    doc.fontSize(16).text('ARV & Offer Price').moveDown()
    doc.fontSize(8)
    doc.table({
      columnStyles: { 0: 200, 1: 100 },
      rowStyles: i => i < 1 ? { border: [0, 0, 1, 0] } : { border: false },
      data: [
        ['Metric', 'Value'],
        [`ARV = $${formatMoney(financialProjection.pricePerFoot)} × ${property.meta.square_footage}`, formatMoney(financialProjection.ARV)],
        [`Offer price (ARV × 0.75) - $${formatMoney(property.meta.renovation_cost)}`, formatMoney(financialProjection.offer_price)],
      ],
    })

    doc.end()
    return endPromise
  }
}
