// generate-pdf.ts
import PDFDocument from "pdfkit";
import fs from "fs";

async function main() {
  const data = {
    rentMarket: 2471,
    egiMarket: 26687,
    expMarket: 12009,
    noiMarket: 14678,
    rentHud:    2747,
    egiHud:    29667,
    expHud:    13350,
    noiHud:    16317,
    sqft:      1443,
    ppsf:      173.40,
    renoCost:  20000,
  };

  const arv   = Math.round(data.sqft * data.ppsf);
  const offer = Math.round(arv * 0.75 - data.renoCost);

  // 1) create the doc and pipe it to a file
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(fs.createWriteStream("stage4.pdf"));

  // 2) add text; PDFKit automatically advances the cursor
  doc.fontSize(18).text("Stage 4 – Stabilized NOI & Offer Price");
  doc.moveDown();

  // 3) draw a simple table by using fixed-width cells
  doc.fontSize(12).font("Helvetica-Bold");
  doc.text("Scenario".padEnd(15) +
    "Rent/mo".padEnd(12) +
    "EGI (10% vac)".padEnd(15) +
    "Expenses".padEnd(12) +
    "NOI");
  doc.moveDown(0.5);

  doc.font("Helvetica");
  [
    ["Market", data.rentMarket, data.egiMarket, data.expMarket, data.noiMarket],
    ["HUD",    data.rentHud,    data.egiHud,    data.expHud,    data.noiHud]
  ].forEach(row => {
    const [scenario, rent, egi, exp, noi] = row;
    doc.text(
      String(scenario).padEnd(15) +
      `$${rent.toLocaleString()}`.padEnd(12) +
      `$${egi.toLocaleString()}`.padEnd(15) +
      `$${exp.toLocaleString()}`.padEnd(12) +
      `$${noi.toLocaleString()}`
    );
  });

  doc.moveDown(2);
  doc.font("Helvetica-Bold")
    .text(`ARV (${data.sqft} sqft × $${data.ppsf}/sqft) = $${arv.toLocaleString()}`);
  doc.moveDown(0.5);
  doc.text(`Offer = (ARV × 0.75) – $${data.renoCost.toLocaleString()} = $${offer.toLocaleString()}`);

  // 4) finalize
  doc.end();
  console.log("✅ stage4.pdf generated via PDFKit");
}

main().catch(console.error);
