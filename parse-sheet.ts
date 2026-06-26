import fs from "fs";

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function cleanPrice(val: string): number {
  if (!val) return 0;
  const cleanStr = val.replace(/Rp/gi, "").replace(/[\s\.\,\"\-]/g, "");
  const num = parseInt(cleanStr, 10);
  return isNaN(num) ? 0 : num;
}

function cleanNumber(val: string): number {
  if (!val) return 0;
  const num = parseInt(val.replace(/[\s\.\,]/g, ""), 10);
  return isNaN(num) ? 0 : num;
}

// Branch name mappings for PT Gadai Sejahtera Indonesia (GSI)
const LOCATION_MAP: Record<string, string> = {
  "MT": "Moh Toha",
  "KC": "Kiaracondong",
  "KI": "Kopo Immanuel",
  "JT": "Jatinangor",
  "RE": "Rancaekek",
  "RB": "Rancabolang",
  "GB": "Gedebage",
  "TP": "Terusan Pasirkoja",
  "PG": "Pagarsih",
  "CG": "Cigondewah",
  "CM": "Cimahi",
  "SP": "Surapati",
  "DU": "Dipatiukur",
  "TR": "Taman Rahayu",
  "GK": "Gegerkalong",
  "SY": "Sayati",
  "CB": "Cibiru",
  "BS": "Bojongsoang",
  "KK": "Kebon Kopi",
  "MT1": "Moh Toha 1",
  "KP": "Kantor Pusat",
  "GUDANG": "Gudang Utama"
};

function runParser() {
  const csvContent = fs.readFileSync("src/raw_sheet.csv", "utf-8");
  const lines = csvContent.split(/\r?\n/);
  
  const items: any[] = [];
  let isDataStarted = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = parseCSVLine(line);
    
    // Check if we hit the header
    if (parts.some(p => p.toUpperCase() === "KODE ASET")) {
      isDataStarted = true;
      continue;
    }
    
    if (!isDataStarted) continue;
    
    // Stop parsing if we hit a footer or total row
    if (parts[1] && (parts[1].toLowerCase().includes("total") || parts[3]?.toLowerCase().includes("total"))) {
      continue;
    }
    
    const no = parts[0];
    const code = parts[1];
    let category = parts[2] || "LAIN-LAIN";
    const name = parts[3];
    const spec = parts[4];
    const quantityStr = parts[5];
    const priceUnitStr = parts[6];
    const priceTotalStr = parts[7];
    const acquisitionDate = parts[8];
    const locationCode = (parts[9] || "KP").toUpperCase();
    const rawCondition = parts[10] || "BAIK";
    const usefulLifeStr = parts[11];
    const depreciationStr = parts[14];
    
    if (!code && !name) continue;
    if (code === "KODE ASET" || name === "NAMA BARANG") continue;
    
    // Normalize Category
    category = category.toUpperCase();
    if (category === "ELEKTONIK") category = "ELEKTRONIK";
    if (category === "RTK" || category === "RTK/PERLENGKAPAN") category = "RUMAH TANGGA KANTOR (RTK)";
    
    const qty = cleanNumber(quantityStr) || 1;
    const priceUnit = cleanPrice(priceUnitStr);
    const priceTotal = priceUnit * qty;
    const usefulLife = cleanNumber(usefulLifeStr);
    const depreciation = cleanPrice(depreciationStr);
    
    // Determine standardized status
    let status = "Baik";
    const condUpper = rawCondition.toUpperCase();
    if (
      condUpper.includes("RUSAK BERAT") || 
      condUpper.includes("TIDAK BERFUNGSI") || 
      condUpper === "1 RUSAK" ||
      condUpper === "RUSAK PARAH"
    ) {
      status = "Rusak Berat";
    } else if (
      condUpper.includes("RUSAK") || 
      condUpper.includes("KURANG BAIK") || 
      condUpper.includes("SLEK") || 
      condUpper.includes("MACET") || 
      condUpper.includes("PECAH") || 
      condUpper.includes("RESLETING") || 
      condUpper.includes("SLETING") || 
      condUpper.includes("TIDAK ADA CASAN") ||
      condUpper.includes("GAADA") ||
      condUpper.includes("HABIS")
    ) {
      status = "Rusak Ringan";
    } else if (condUpper === "-" || !condUpper) {
      status = "Tidak Diketahui";
    }
    
    items.push({
      id: code || `INV-GEN/${category.substring(0,2).toUpperCase()}/${String(items.length + 1).padStart(3, "0")}`,
      no: no || String(items.length + 1),
      code: code || "",
      category,
      name: name || "Tanpa Nama",
      spec: spec || "",
      qty,
      priceUnit,
      priceTotal,
      acquisitionDate: acquisitionDate || "-",
      locationCode,
      locationName: LOCATION_MAP[locationCode] || `Cabang ${locationCode}`,
      conditionRaw: rawCondition || "BAIK",
      status,
      usefulLife,
      depreciation
    });
  }
  
  // Collect unique statistics
  const locationsSet = new Set<string>();
  const categoriesSet = new Set<string>();
  const statusesSet = new Set<string>();
  
  items.forEach(item => {
    locationsSet.add(item.locationCode);
    categoriesSet.add(item.category);
    statusesSet.add(item.status);
  });
  
  const stats = {
    totalItems: items.length,
    totalQty: items.reduce((sum, item) => sum + item.qty, 0),
    totalValue: items.reduce((sum, item) => sum + item.priceTotal, 0),
    locations: Array.from(locationsSet).sort().map(code => ({
      code,
      name: LOCATION_MAP[code] || `Cabang ${code}`,
      itemCount: items.filter(i => i.locationCode === code).length,
      itemQty: items.filter(i => i.locationCode === code).reduce((sum, i) => sum + i.qty, 0),
      totalValue: items.filter(i => i.locationCode === code).reduce((sum, i) => sum + i.priceTotal, 0)
    })),
    categories: Array.from(categoriesSet).sort().map(cat => ({
      name: cat,
      itemCount: items.filter(i => i.category === cat).length,
      totalValue: items.filter(i => i.category === cat).reduce((sum, i) => sum + i.priceTotal, 0)
    })),
    statuses: Array.from(statusesSet).sort().map(status => ({
      name: status,
      count: items.filter(i => i.status === status).length
    }))
  };
  
  // Write to clean JSON files
  fs.writeFileSync("src/inventory_data.json", JSON.stringify(items, null, 2));
  fs.writeFileSync("src/inventory_stats.json", JSON.stringify(stats, null, 2));
  
  console.log("Standardized parsing completed successfully!");
  console.log("Total parsed rows:", items.length);
}

runParser();
