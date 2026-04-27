// ILIA · Inventaire — Google Apps Script
const SPREADSHEET_ID = "1BtjZyjjzfplJONzStQ4aAXv60QYIyZRhI5vMKu0WngI";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    if (action === "saveInventaire") return saveInventaire(data);
    if (action === "saveTransfert")  return saveTransfert(data);
    if (action === "getInventaire")  return getInventaire(data);
    if (action === "saveAchat")      return saveAchat(data);
    return jsonResponse({ error: "Unknown action: " + action });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doGet(e) {
  try {
    // Mode écriture via param "data" (contourne CORS depuis GitHub Pages)
    if (e.parameter.data) {
      const payload = JSON.parse(decodeURIComponent(e.parameter.data));
      const action = payload.action;
      if (action === "saveInventaire") return saveInventaire(payload);
      if (action === "saveTransfert")  return saveTransfert(payload);
      if (action === "saveAchat")      return saveAchat(payload);
    }
    // Mode lecture
    const action = e.parameter.action;
    if (action === "getInventaire") return getInventaire(e.parameter);
    if (action === "getTransferts") return getTransferts(e.parameter);
    if (action === "getZelty") return getZelty(e.parameter);
    if (action === "getAchats") return getAchats(e.parameter);
    return jsonResponse({ error: "Unknown action" });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function saveInventaire(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Inventaire");
  const ts = new Date().toISOString();
  deleteExistingRows(sheet, data.restaurant, data.semaine, data.proteine, data.type);
  const lignes = data.lignes || [];
  if (lignes.length === 0) {
    sheet.appendRow([data.restaurant, data.semaine, data.proteine, data.type, "", 0, 0, ts, data.valide ? "oui" : "non"]);
  } else {
    lignes.forEach(function(l) {
      sheet.appendRow([data.restaurant, data.semaine, data.proteine, data.type, l.etat || "", l.poids_brut || 0, l.tare || 0, ts, data.valide ? "oui" : "non"]);
    });
  }
  return jsonResponse({ ok: true, rows: lignes.length || 1 });
}

function saveTransfert(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Transferts");
  const sem = data.semaine || data.sem || "";
  sheet.appendRow([data.from, data.to, sem, data.prot, data.etat || "", data.poids_brut || 0, data.tare || 0, data.qty_net || 0, data.note || "", data.date || new Date().toLocaleDateString("fr-FR")]);
  return jsonResponse({ ok: true });
}

function getInventaire(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Inventaire");
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return jsonResponse({ rows: [] });
  let rows = data.slice(1).map(function(row) {
    return { restaurant: row[0], semaine: row[1], proteine: row[2], type: row[3], etat: row[4], poids_brut: row[5], tare: row[6], timestamp: row[7], valide: row[8] === "oui" };
  });
  if (params.restaurant) rows = rows.filter(function(r) { return r.restaurant === params.restaurant; });
  if (params.semaine)    rows = rows.filter(function(r) { return r.semaine === params.semaine; });
  return jsonResponse({ rows: rows });
}

function getTransferts(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Transferts");
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return jsonResponse({ rows: [] });
  let rows = data.slice(1).map(function(row) {
    return { from: row[0], to: row[1], semaine: row[2], prot: row[3], etat: row[4], poids_brut: row[5], tare: row[6], qty_net: row[7], note: row[8], date: row[9] };
  });
  if (params.semaine) rows = rows.filter(function(r) { return r.semaine === params.semaine; });
  return jsonResponse({ rows: rows });
}

function getZelty(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Zelty");
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return jsonResponse({ rows: [] });
  const rows = data.slice(1).map(function(row) {
    return {
      restaurant: row[0],
      semaine: row[1],
      proteine: row[2],
      portions_sig: row[3],
      portions_opt: row[4]
    };
  });
  return jsonResponse({ rows: rows });
}

function getAchats(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Achats");
  const data = sheet.getDataRange().getDisplayValues(); // getDisplayValues = texte affiché, pas dates ISO
  if (data.length <= 1) return jsonResponse({ rows: [] });
  const rows = data.slice(1).map(function(row) {
    return {
      fournisseur: row[0],
      restaurant: row[1],
      mois: row[2],
      article: row[3],
      qty: parseFloat(String(row[4]).replace(',', '.')) || 0,
      unite: row[5],
      montant_ht: parseFloat(String(row[6]).replace(',', '.')) || 0,
      source: row[7]
    };
  });
  return jsonResponse({ rows: rows });
}

function saveAchat(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Achats");
  sheet.appendRow([
    data.fournisseur,
    data.restaurant,
    data.mois,
    data.article,
    data.qty || 0,
    data.unite || "",
    data.montant_ht || 0,
    data.source || "Manuel"
  ]);
  return jsonResponse({ ok: true });
}

function deleteExistingRows(sheet, restaurant, semaine, proteine, type) {
  const data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === restaurant && data[i][1] === semaine && data[i][2] === proteine && data[i][3] === type) {
      sheet.deleteRow(i + 1);
    }
  }
}

function jsonResponse(obj) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
