import PDFDocument from 'pdfkit'
import fs from 'fs'
import { BaseProvider } from 'providers/base.ts'
import { PrismaClient } from 'prisma'
import { formatPercents } from 'utils/number.ts'

const prisma = new PrismaClient()

export class InvestmentSummaryProvider extends BaseProvider {
  getData = async () => {
    const { property } = this.model

    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const outPath = `Assesment - ${property.address.fullAddress}.pdf`

    const stream = fs.createWriteStream(outPath)
    doc.pipe(stream)
    doc.font('Helvetica')

    doc.fontSize(20).text('Stage 1')
    doc.moveDown()

    doc.fontSize(16).text('Physical Characteristics')
    doc.moveDown()

    doc.fontSize(10)
    doc.table({
      rowStyles: (i) => {
        return i < 1 ? { border: [0, 0, 1, 0] } : { border: false }
      },
      data: [
        ['Feature', 'Value'],
        ['Property type', property.type],
        ['Year built', property.meta.year_built],
        ['Square footage', property.meta.square_footage],
        ['Lot size (square ft.)', property.meta.lot_size_sqft],
        ['Bedrooms', property.meta.bedrooms],
        ['Bathrooms', property.meta.bathrooms],
      ],
    })
    doc.moveDown()

    doc.fontSize(16).text('Financial Details')
    doc.moveDown()

    doc.fontSize(10)
    doc.table({
      rowStyles: (i) => {
        return i < 1 ? { border: [0, 0, 1, 0] } : { border: false }
      },
      data: [
        ['Feature', 'Value'],
        ['Assessed value', property.meta.assessed_value],
        ['Annual property taxes', property.meta.annual_property_tax],
        ['AVM value', property.meta.avm_value],
      ],
    })
    doc.moveDown()

    doc.fontSize(20).text('Stage 2')
    doc.moveDown()

    doc.fontSize(16).text('Rent Estimates')

    doc.fontSize(10)
    doc.table({
      rowStyles: (i) => {
        return i < 1 ? { border: [0, 0, 1, 0] } : { border: false }
      },
      data: [
        ['Feature', 'Value'],
        ['Market rent (based on comps)', property.meta.avg_rent],
        ['HUD FMR', property.meta.fmr],
      ],
    })
    doc.moveDown()


    const rentComps = await prisma.lookupResult.findMany({
      where: {
        propertyId: property.id,
        resultType: 'sales_comp',
      }
    })

    const comps = rentComps.map(row => JSON.parse(row.json))

    doc.fontSize(16).text('Sales Comparables')
    doc.fontSize(10)
    doc.table({
      columnStyles: [200, '*', '*', '*', '*', '*', '*', '*'],
      rowStyles: (i) => {
        return i < 1 ? { border: [0, 0, 1, 0] } : { border: false }
      },
      data: [
        ['Address', 'Price', 'Beds', 'Baths', 'Sq Ft', 'Sold date', 'Distance'],
        ...(comps.map(row => (
          [row.formattedAddress, row.price, row.bedrooms, row.bathrooms, row.squareFootage, row.listedDate, row.distance]
        )))
      ],
    })
    doc.moveDown();

    const demographicsRecord = await prisma.lookupResult.findFirst({
      where: {
        propertyId: property.id,
        resultType: 'demographics_data',
      }
    });

    const demographicsData = JSON.parse(demographicsRecord?.json || '{}');

    doc.fontSize(16).text('Demographics')
    doc.fontSize(10)
    doc.table({
      columnStyles: [200, '*'],
      rowStyles: (i) => {
        return i < 1 ? { border: [0, 0, 1, 0] } : { border: false }
      },
      data: [
        ['Metric', 'Value'],
        ['Median Household Income', demographicsData.medianIncome],
        ['Population (Est.)', demographicsData.totalPopulation],
        ['Race Breakdown:', ''],
        ['- Black African American', formatPercents(demographicsData.blackPopulation, demographicsData.totalPopulation)],
        ['- White (Non-Hispanic)', formatPercents(demographicsData.whitePopulation, demographicsData.totalPopulation)],
        ['- Hispanic/Latino', formatPercents(demographicsData.latinoPopulation, demographicsData.totalPopulation)],
        ['Owner-Occupied Housing', formatPercents(demographicsData.housingUnits - demographicsData.renterUnits, demographicsData.housingUnits)],
        ['Renter-Occupied', formatPercents(demographicsData.renterUnits, demographicsData.housingUnits)],
      ],
    });
    doc.moveDown();


    const relatedPlaces = await prisma.lookupResult.findMany({
      where: {
        propertyId: property.id,
        resultType: 'related_place',
      },
      take: 6
    })

    const places = relatedPlaces.map(row => JSON.parse(row.json))

    doc.fontSize(16).text('Institutional Anchors')
    doc.fontSize(10)
    doc.table({
      columnStyles: [120, 270, 45, '*'],
      rowStyles: (i) => {
        return i < 1 ? { border: [0, 0, 1, 0] } : { border: false }
      },
      data: [
        ['Type', 'Name', 'Distance', 'Size'],
        ...(places.map(row => (
          [row.type, row.name.text, row.distance.toFixed(2), 'N/A']
        )))
      ],
    });
    doc.moveDown();

    doc.fontSize(20).text('Stage 3: Underwriting Assumptions Summary')
    doc.fontSize(10).text(`Property: ${property.address.fullAddress}`)
    doc.fontSize(10).text(`Type: ${property.type} | Year Built: ${property.meta.year_built} | Sq. Ft. ${property.meta.square_footage}`)
    doc.moveDown();


    doc.fontSize(16).text('Income Assumptions')
    doc.fontSize(10).text(`Market rent: ${property.meta.avg_rent}`)
    doc.fontSize(10).text(`HUD Rent: ${property.meta.fmr}`)
    doc.fontSize(10).text(`Vacancy rate: ${formatPercents(property.meta.vacancy)}`)
    doc.moveDown(2);

    doc.fontSize(16).text('Expense Assumptions')
    doc.fontSize(10).text(`Expense Ratio Range: ${property.meta.expense_rate_type}`)
    doc.fontSize(10).text(`Used: ${formatPercents(property.meta.expense_rate)}`)
    doc.moveDown(2);


    doc.fontSize(16).text('Renovation')
    doc.fontSize(10).text(`Scope: ${property.meta.renovation_scope}`)
    doc.fontSize(10).text(`Estimated cost: ${property.meta.renovation_cost}`)
    doc.moveDown(2);

    doc.fontSize(20).text('Stage 4: Stabilized NOl & Offer Price')
    doc.moveDown();

    const projectionRecord = await prisma.lookupResult.findFirst({
      where: {
        propertyId: property.id,
        resultType: 'financial_projection',
      }
    });

    const financialProjection = JSON.parse(projectionRecord?.json || '{}');

    doc.fontSize(16).text('Income, Expenses & NOI Summary')
    doc.fontSize(10)
    doc.table({
      columnStyles: ['*', '*','*','*','*'],
      rowStyles: (i) => {
        return i < 1 ? { border: [0, 0, 1, 0] } : { border: false }
      },
      data: [
        ['Scenario', 'Rent/mo', 'EGI', `Expenses (${formatPercents(property.meta.expense_rate)})`, 'NOI'],
        ['Market', property.meta.avg_rent, financialProjection.marketNOI.EGI, financialProjection.marketNOI.expenses, financialProjection.marketNOI.expenses],
        ['HUD', property.meta.fmr, financialProjection.fmrNOI.EGI, financialProjection.fmrNOI.EGI, financialProjection.fmrNOI.EGI],
      ],
    })
    doc.moveDown();

    doc.fontSize(16).text('ARV & Offer Price')
    doc.fontSize(10);
    doc.table({
      columnStyles: [270, '*'],
      rowStyles: (i) => {
        return i < 1 ? { border: [0, 0, 1, 0] } : { border: false }
      },
      data: [
        ['Metric', 'Value'],
        [`ARV $${financialProjection.pricePerFoot}*${property.meta.square_footage}`, financialProjection.ARV],
        [`Offer value (ARV × 0.75) - $${property.meta.renovation_cost}`, financialProjection.offer_price],
      ],
    })
    doc.moveDown();

    doc.end()

    await new Promise<void>((resolve, reject) => {
      stream.on('finish', resolve)
      stream.on('error', (err) => reject(err))
    })
  }
}
