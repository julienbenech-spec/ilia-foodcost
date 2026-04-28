// ILIA · Inventaire — Google Apps Script
const SPREADSHEET_ID = "1BtjZyjjzfplJONzStQ4aAXv60QYIyZRhI5vMKu0WngI";
const ZELTY_API_KEY  = "MTk5NzQ6V6HdyWUYGuZhFNX50WjTC4dad8=";
const ZELTY_BASE     = "https://api.zelty.fr/2.10";
const ZELTY_RESTOS   = { "Washington":7022, "Mathurins":9080, "Riviere":9185, "Casanova":9281, "Vernier":9283 };
const PROTEINES_SIG  = { "Saumon":["Jul's Bowl"], "Thon":["Fish Bowl"], "Boeuf":["Meat Bowl"], "Poulet":["John's Bowl"] };
const PROTEINES_OPT  = {
  "Saumon": ["Saumon zaatar  ♨️","Saumon zaatar ♨️","Saumon Zaatar","Saumon zaatar"],
  "Thon":   ["Thon mi-cuit","Thon mi cuit"],
  "Boeuf":  ["Boeuf Effiloché","Boeuf effiloché"],
  "Poulet": ["Poulet mariné aux épices ♨️","Poulet Grillé","Poulet grillé"]
};

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
      if (action === "saveInventaire")        return saveInventaire(payload);
      if (action === "saveTransfert")         return saveTransfert(payload);
      if (action === "saveAchat")             return saveAchat(payload);
      if (action === "saveInventaireJour")    return saveInventaireJour(payload);
    }
    // Mode lecture
    const action = e.parameter.action;
    if (action === "getInventaire")       return getInventaire(e.parameter);
    if (action === "getTransferts")       return getTransferts(e.parameter);
    if (action === "getZelty")            return getZelty(e.parameter);
    if (action === "getAchats")           return getAchats(e.parameter);
    if (action === "getVentesJour")       return getVentesJour(e.parameter);
    if (action === "getInventaireJour")   return getInventaireJour(e.parameter);
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

// ── INVENTAIRE JOURNALIER ────────────────────────────────────────────────────

function getVentesJour(params) {
  // Récupère les ventes Zelty sur un service (10h-15h par défaut)
  var restaurant = params.restaurant || "Washington";
  var date       = params.date || new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  var heureDebut = params.heure_debut || "10:00";
  var heureFin   = params.heure_fin   || "15:00";

  var restoId = ZELTY_RESTOS[restaurant];
  if (!restoId) return jsonResponse({ error: "Restaurant inconnu: " + restaurant });

  var fromDt = date + "T" + heureDebut + ":00";
  var toDt   = date + "T" + heureFin   + ":00";

  // Compter portions sig + opt par protéine
  var counts = { Saumon:{sig:0,opt:0}, Thon:{sig:0,opt:0}, Boeuf:{sig:0,opt:0}, Poulet:{sig:0,opt:0} };

  var offset = 0;
  var hasMore = true;
  while (hasMore) {
    var url = ZELTY_BASE + "/orders?restaurant_id=" + restoId +
              "&from=" + encodeURIComponent(fromDt) +
              "&to="   + encodeURIComponent(toDt) +
              "&expand[]=items&limit=200&offset=" + offset;
    var resp = UrlFetchApp.fetch(url, {
      headers: { Authorization: "Bearer " + ZELTY_API_KEY },
      muteHttpExceptions: true
    });
    if (resp.getResponseCode() !== 200) break;
    var data = JSON.parse(resp.getContentText());
    var orders = data.orders || [];
    if (orders.length === 0) { hasMore = false; break; }

    orders.forEach(function(order) {
      (order.items || []).forEach(function(item) {
        var name = item.name || "";
        // Signature (dish direct)
        if (item.type === "dish") {
          for (var prot in PROTEINES_SIG) {
            if (PROTEINES_SIG[prot].indexOf(name) >= 0) {
              counts[prot].sig += (item.quantity || 1);
            }
          }
        }
        // Options (modifiers dans les menus)
        (item.modifiers || []).forEach(function(mod) {
          var mname = mod.name || "";
          for (var prot in PROTEINES_OPT) {
            if (PROTEINES_OPT[prot].indexOf(mname) >= 0) {
              counts[prot].opt += 1;
            }
          }
        });
      });
    });

    offset += orders.length;
    if (orders.length < 200) hasMore = false;
  }

  // Calculer total portions et grammage théorique
  var GRAMMAGES = { Saumon:100, Thon:80, Boeuf:70, Poulet:130 };
  var result = {};
  for (var p in counts) {
    var total = counts[p].sig + counts[p].opt;
    result[p] = {
      portions_sig: counts[p].sig,
      portions_opt: counts[p].opt,
      total_portions: total,
      grammage_theo_g: GRAMMAGES[p],
      theo_net_kg: Math.round(total * GRAMMAGES[p]) / 1000
    };
  }
  return jsonResponse({ restaurant: restaurant, date: date, service: heureDebut+"-"+heureFin, ventes: result });
}

function saveInventaireJour(data) {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName("InventaireJournalier");
  var ts    = new Date().toISOString();

  // Supprimer les lignes existantes pour ce restaurant+date+service+proteine
  var existing = sheet.getDataRange().getValues();
  for (var i = existing.length - 1; i >= 1; i--) {
    if (existing[i][0] === data.restaurant && existing[i][1] === data.date &&
        existing[i][2] === data.service    && existing[i][3] === data.proteine) {
      sheet.deleteRow(i + 1);
    }
  }

  // Calculer grammage réel si stock début + fin + portions disponibles
  var conso_net = 0;
  if (data.stock_debut_kg !== undefined && data.stock_fin_kg !== undefined) {
    conso_net = (parseFloat(data.stock_debut_kg) || 0) - (parseFloat(data.stock_fin_kg) || 0);
  }
  var grammage_reel = data.total_portions > 0
    ? Math.round((conso_net * 1000) / data.total_portions * 10) / 10
    : 0;

  sheet.appendRow([
    data.restaurant,
    data.date,
    data.service || "midi",
    data.proteine,
    data.etat || "",
    data.stock_debut_kg || 0,
    data.stock_fin_kg !== undefined ? data.stock_fin_kg : "",
    data.total_portions || 0,
    grammage_reel,
    data.grammage_theo_g || 0
  ]);

  return jsonResponse({ ok: true });
}

function getInventaireJour(params) {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName("InventaireJournalier");
  var data  = sheet.getDataRange().getDisplayValues();
  if (data.length <= 1) return jsonResponse({ rows: [] });

  var rows = data.slice(1).map(function(row) {
    return {
      restaurant:    row[0], date:            row[1], service:       row[2],
      proteine:      row[3], etat:            row[4], stock_debut:   row[5],
      stock_fin:     row[6], portions:        row[7], grammage_reel: row[8],
      grammage_theo: row[9]
    };
  });

  if (params.restaurant) rows = rows.filter(function(r) { return r.restaurant === params.restaurant; });
  if (params.date)       rows = rows.filter(function(r) { return r.date === params.date; });

  return jsonResponse({ rows: rows });
}
