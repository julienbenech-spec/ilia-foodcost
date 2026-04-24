// ILIA · Inventaire — Google Apps Script
// Spreadsheet ID cible
const SPREADSHEET_ID = "1BtjZyjjzfplJONzStQ4aAXv60QYIyZRhI5vMKu0WngI";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === "saveInventaire") {
      return saveInventaire(data);
    } else if (action === "saveTransfert") {
      return saveTransfert(data);
    } else if (action === "getInventaire") {
      return getInventaire(data);
    } else {
      return jsonResponse({ error: "Unknown action: " + action }, 400);
    }
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

function doGet(e) {
  // Pour les lectures (CORS-friendly)
  try {
    const action = e.parameter.action;
    if (action === "getInventaire") {
      return getInventaire(e.parameter);
    } else if (action === "getTransferts") {
      return getTransferts(e.parameter);
    }
    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
}

// ── SAVE INVENTAIRE ──────────────────────────────────────────────────────────
// Payload attendu :
// { action, restaurant, semaine, proteine, type ("debut"|"fin"), lignes: [{etat, poids_brut, tare}], valide: bool }
function saveInventaire(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Inventaire");
  const ts = new Date().toISOString();

  // Supprimer les lignes existantes pour ce restaurant/semaine/proteine/type
  deleteExistingRows(sheet, data.restaurant, data.semaine, data.proteine, data.type);

  // Ajouter les nouvelles lignes
  const lignes = data.lignes || [];
  if (lignes.length === 0) {
    // Ligne vide pour indiquer "validé sans lignes"
    sheet.appendRow([
      data.restaurant,
      data.semaine,
      data.proteine,
      data.type,
      "",
      0,
      0,
      ts,
      data.valide ? "oui" : "non"
    ]);
  } else {
    lignes.forEach(function(l) {
      sheet.appendRow([
        data.restaurant,
        data.semaine,
        data.proteine,
        data.type,
        l.etat || "",
        l.poids_brut || 0,
        l.tare || 0,
        ts,
        data.valide ? "oui" : "non"
      ]);
    });
  }

  return jsonResponse({ ok: true, rows: lignes.length || 1 });
}

// ── SAVE TRANSFERT ───────────────────────────────────────────────────────────
// Payload : { action, id, from, to, semaine, prot, etat, poids_brut, tare, qty_net, note, date }
function saveTransfert(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Transferts");

  sheet.appendRow([
    data.from,
    data.to,
    data.semaine,
    data.prot,
    data.etat || "",
    data.poids_brut || 0,
    data.tare || 0,
    data.qty_net || 0,
    data.note || "",
    data.date || new Date().toLocaleDateString("fr-FR")
  ]);

  return jsonResponse({ ok: true });
}

// ── GET INVENTAIRE ───────────────────────────────────────────────────────────
// Params : restaurant (optionnel), semaine (optionnel)
function getInventaire(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Inventaire");
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return jsonResponse({ rows: [] });

  const headers = data[0];
  let rows = data.slice(1).map(function(row) {
    return {
      restaurant: row[0],
      semaine: row[1],
      proteine: row[2],
      type: row[3],
      etat: row[4],
      poids_brut: row[5],
      tare: row[6],
      timestamp: row[7],
      valide: row[8] === "oui"
    };
  });

  if (params.restaurant) rows = rows.filter(r => r.restaurant === params.restaurant);
  if (params.semaine) rows = rows.filter(r => r.semaine === params.semaine);

  return jsonResponse({ rows: rows });
}

// ── GET TRANSFERTS ───────────────────────────────────────────────────────────
function getTransferts(params) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("Transferts");
  const data = sheet.getDataRange().getValues();

  if (data.length <= 1) return jsonResponse({ rows: [] });

  let rows = data.slice(1).map(function(row) {
    return {
      from: row[0],
      to: row[1],
      semaine: row[2],
      prot: row[3],
      etat: row[4],
      poids_brut: row[5],
      tare: row[6],
      qty_net: row[7],
      note: row[8],
      date: row[9]
    };
  });

  if (params.semaine) rows = rows.filter(r => r.semaine === params.semaine);

  return jsonResponse({ rows: rows });
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
function deleteExistingRows(sheet, restaurant, semaine, proteine, type) {
  const data = sheet.getDataRange().getValues();
  // Parcourir à l'envers pour supprimer sans décalage d'index
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === restaurant &&
        data[i][1] === semaine &&
        data[i][2] === proteine &&
        data[i][3] === type) {
      sheet.deleteRow(i + 1);
    }
  }
}

function jsonResponse(obj, code) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
