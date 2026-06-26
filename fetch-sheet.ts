import fs from "fs";

async function fetchSheet() {
  const url = "https://docs.google.com/spreadsheets/d/1B2J0SmukJrCKo1tisUsQH0J_0yNUjh8s-5_4gJzZfqo/export?format=csv&gid=620748072";
  console.log("Fetching URL:", url);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const csvText = await response.text();
    console.log("Fetched CSV length:", csvText.length);
    console.log("CSV Preview (first 500 chars):");
    console.log(csvText.substring(0, 500));
    
    // Save raw CSV
    fs.writeFileSync("src/raw_sheet.csv", csvText);
    console.log("Saved raw_sheet.csv");
  } catch (err) {
    console.error("Error fetching sheet:", err);
  }
}

fetchSheet();
