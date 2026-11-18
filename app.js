"use strict";

const select = selector => document.querySelector(selector);
const selectAll = selector => Array.from(document.querySelectorAll(selector));
const fields = selectAll("[data-field]");
const byKey = new Map(fields.map(field => [field.dataset.field, field]));
const storageKey = "ra4-practica-redes-v2";
const legacyKey = "ra4-practica-redes-v1";
let legacyNotes = {};
let pendingImport = null;

function value(key) {
  return (byKey.get(key)?.value || "").trim();
}

function label(field) {
  return field.closest("label").firstChild.textContent.trim();
}

function snapshot() {
  return Object.fromEntries(fields.map(field => [field.dataset.field, field.value]));
}

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({version: 2, fields: snapshot(), legacy: legacyNotes}));
    select("#save-status").textContent = "Registros guardados en este navegador.";
  } catch {
    select("#save-status").textContent = "El guardado local no está disponible. Descarga un respaldo para conservar tus registros.";
  }
}

function applyValues(data) {
  fields.forEach(field => { field.value = typeof data[field.dataset.field] === "string" ? data[field.dataset.field] : ""; });
}

function showLegacy() {
  const present = Object.keys(legacyNotes).length > 0;
  select("#legacy-block").hidden = !present;
  select("#legacy").textContent = Object.entries(legacyNotes)
    .map(([key, text]) => key + "\n" + String(text)).join("\n\n");
}

try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
  if (saved && saved.version === 2 && saved.fields) {
    applyValues(saved.fields);
    legacyNotes = saved.legacy && typeof saved.legacy === "object" ? saved.legacy : {};
  } else {
    const legacy = JSON.parse(localStorage.getItem(legacyKey) || "{}");
    if (legacy && typeof legacy === "object") {
      legacyNotes = Object.fromEntries(Object.entries(legacy).filter(([, text]) => typeof text === "string" && text.trim()));
      if (typeof legacy.equipo === "string") byKey.get("equipo").value = legacy.equipo;
    }
  }
} catch {
  select("#save-status").textContent = "No fue posible recuperar el guardado local. Puedes cargar un respaldo JSON.";
}
showLegacy();

const subnetExpected = {
  "adm-h": "6", "adm-prefix": "/26", "adm-mask": "255.255.255.192",
  "adm-network": "192.168.10.0", "adm-first": "192.168.10.1",
  "adm-last": "192.168.10.62", "adm-broadcast": "192.168.10.63", "adm-gateway": "192.168.10.1",
  "ope-h": "5", "ope-prefix": "/27", "ope-mask": "255.255.255.224",
  "ope-network": "192.168.10.64", "ope-first": "192.168.10.65",
  "ope-last": "192.168.10.94", "ope-broadcast": "192.168.10.95", "ope-gateway": "192.168.10.65"
};

function normalized(key, text) {
  const result = text.trim();
  return key.endsWith("-prefix") ? result.replace(/^\//, "") : result;
}

function subnetIssues(data) {
  return Object.entries(subnetExpected).filter(([key, expected]) =>
    normalized(key, data[key] || "") !== normalized(key, expected));
}

function feedbackList(target, messages) {
  target.replaceChildren();
  const list = document.createElement("ul");
  messages.forEach(message => {
    const item = document.createElement("li");
    item.textContent = message;
    list.append(item);
  });
  target.append(list);
}

select("#check-subnets").addEventListener("click", () => {
  const issues = subnetIssues(snapshot());
  Object.keys(subnetExpected).forEach(key => byKey.get(key).removeAttribute("aria-invalid"));
  issues.forEach(([key]) => byKey.get(key).setAttribute("aria-invalid", "true"));
  feedbackList(select("#subnet-feedback"), issues.length
    ? issues.map(([key, expected]) => {
      const area = key.startsWith("adm-") ? "Administración" : "Operaciones";
      const explanation = value(key) ? "Revisa el cálculo." : "Completa este campo.";
      return area + " · " + label(byKey.get(key)) + ". " + explanation + " Valor esperado en este ejercicio: " + expected + ".";
    })
    : ["Los 16 datos coinciden con los bloques mínimos y consecutivos solicitados. Explica ahora cómo calculaste cada límite."]);
});

const pcPlan = {
  adm1: {ip: "192.168.10.2", mask: "255.255.255.192", gateway: "192.168.10.1"},
  adm2: {ip: "192.168.10.3", mask: "255.255.255.192", gateway: "192.168.10.1"},
  ope1: {ip: "192.168.10.66", mask: "255.255.255.224", gateway: "192.168.10.65"},
  ope2: {ip: "192.168.10.67", mask: "255.255.255.224", gateway: "192.168.10.65"}
};

function pcIssues(data) {
  const issues = [];
  Object.entries(pcPlan).forEach(([pc, expected]) => {
    Object.entries(expected).forEach(([name, correct]) => {
      if ((data[pc + "-" + name] || "").trim() !== correct) {
        issues.push({key: pc + "-" + name, message: pc.toUpperCase() + " · " + name + ". Según la asignación solicitada se espera " + correct + "."});
      }
    });
  });
  return issues;
}

select("#check-pcs").addEventListener("click", () => {
  const issues = pcIssues(snapshot());
  Object.keys(pcPlan).forEach(pc => ["ip", "mask", "gateway"].forEach(name => byKey.get(pc + "-" + name).removeAttribute("aria-invalid")));
  issues.forEach(issue => byKey.get(issue.key).setAttribute("aria-invalid", "true"));
  feedbackList(select("#pc-feedback"), issues.length ? issues.map(issue => issue.message)
    : ["Las IP, máscaras y gateways coinciden con el diseño. Compara ahora lo registrado con la configuración real de los PC."]);
});

const testPlan = [
  {id: "p1", from: "adm1", to: "192.168.10.1"},
  {id: "p2", from: "ope1", to: "192.168.10.65"},
  {id: "p3", from: "adm1", to: "192.168.10.3"},
  {id: "p4", from: "ope1", to: "192.168.10.67"},
  {id: "p5", from: "adm1", to: "192.168.10.66"},
  {id: "p6", from: "ope2", to: "192.168.10.3"}
];

function testResult(test, data) {
  const get = name => (data[test.id + "-" + name] || "").trim();
  const missing = ["source", "destination", "command", "sent", "received", "evidence", "observation"].filter(name => !get(name));
  if (missing.length) return {complete: false, text: "Registro pendiente. Faltan " + missing.length + " campos."};
  const sent = Number(get("sent"));
  const received = Number(get("received"));
  if (!Number.isInteger(sent) || !Number.isInteger(received) || sent <= 0 || received < 0 || received > sent) {
    return {complete: false, text: "Revisa los conteos. Usa enteros, enviados mayores que cero y recibidos entre cero y enviados."};
  }
  const expectedSource = (data[test.from + "-ip"] || "").trim();
  if (get("source") !== pcPlan[test.from].ip || (expectedSource && get("source") !== expectedSource) || get("destination") !== test.to) {
    return {complete: false, text: "Revisa las IP del trayecto. El origen esperado es " + pcPlan[test.from].ip + " y el destino " + test.to + "."};
  }
  const command = get("command").toLowerCase().split(/\s+/);
  if (command[0] !== "ping" || !command.includes(test.to)) {
    return {complete: false, text: "Registra el comando ping ejecutado hacia " + test.to + "."};
  }
  if (sent !== 4) return {complete: false, text: "Esta guía pide una serie final de cuatro ecos. Repite la serie o registra sus cuatro resultados."};
  const loss = ((sent - received) / sent * 100).toFixed(0);
  return {
    complete: true,
    text: received === 4
      ? "Registro completo · 4/4 respuestas · pérdida 0 %. Cumple el criterio de conectividad del trayecto."
      : "Registro completo · " + received + "/4 respuestas · pérdida " + loss + " %. El trayecto requiere diagnóstico. Conserva este resultado."
  };
}

function refreshTests() {
  const data = snapshot();
  testPlan.forEach(test => { select("#" + test.id + "-status").textContent = testResult(test, data).text; });
}
fields.forEach(field => field.addEventListener("input", () => { save(); refreshTests(); }));
refreshTests();

const questions = [
  {q: "¿Qué prefijo mínimo soporta 50 direcciones utilizables?", a: ["/27, con 30 hosts", "/26, con 62 hosts", "/25, porque siempre hace falta un bloque de 128"], ok: 1, why: "2⁶ − 2 = 62. /26 es el bloque mínimo. Reserva red y broadcast, y asigna las IP de los hosts dentro del rango."},
  {q: "¿Dónde empieza el bloque de Operaciones después de 192.168.10.0/26?", a: ["En .63", "En .64", "En .62"], ok: 1, why: "El bloque /26 contiene .0 a .63. .63 es broadcast y el siguiente bloque empieza en .64."},
  {q: "¿Puede un PC usar 192.168.10.95/27 en Operaciones?", a: ["Sí, porque pertenece al bloque", "Sí, si se usa como gateway", "No, es el broadcast de .64/27"], ok: 2, why: "Los hosts de .64/27 van de .65 a .94. El broadcast .95 se reserva para el segmento."},
  {q: "¿Qué gateway corresponde a OPE1 con 192.168.10.66/27?", a: ["192.168.10.1", "192.168.10.65", "192.168.10.64"], ok: 1, why: "La interfaz de R1 en la subred de Operaciones usa .65. .64 identifica la red y .1 pertenece a Administración."},
  {q: "¿Qué tipo de puerto usa ADM1 en S1?", a: ["Acceso en VLAN 10", "Troncal de todas las VLAN", "Subinterfaz dot1Q"], ok: 0, why: "El PC envía sus tramas por un puerto de acceso de VLAN 10. El troncal del ejercicio está entre S1 y R1."},
  {q: "¿Para qué sirve el troncal S1–R1?", a: ["Para asignar IP automáticamente", "Para transportar las VLAN 10 y 20", "Para cambiar las máscaras de los PC"], ok: 1, why: "802.1Q identifica las VLAN en el enlace. Verifica las VLAN permitidas y la etiqueta de cada subinterfaz."},
  {q: "¿Por qué coincide dot1Q 20 con VLAN 20?", a: ["Porque identifica el tráfico de esa VLAN", "Porque fija una velocidad de 20 Mbps", "Porque asigna la IP .20"], ok: 0, why: "La etiqueta permite entregar las tramas a la subinterfaz de Operaciones. No determina la IP ni la velocidad."},
  {q: "¿Qué tabla relaciona MAC, VLAN y puerto del switch?", a: ["Tabla de rutas", "Tabla MAC", "Lista de gateways"], ok: 1, why: "Genera tráfico, consulta show mac address-table y relaciona la entrada con el puerto del PC."},
  {q: "¿Qué MAC busca ADM1 cuando envía a Operaciones?", a: ["La MAC de su gateway local", "Siempre la MAC final de OPE1", "La del broadcast de Operaciones"], ok: 0, why: "El destino IP está fuera de su subred. ADM1 resuelve por ARP la MAC de su siguiente salto, R1 en VLAN 10."},
  {q: "¿Qué rutas debe tener R1 para este montaje?", a: ["Solo una ruta por defecto a Internet", "Las dos redes directamente conectadas", "Una ruta estática por cada PC"], ok: 1, why: "Las dos subinterfaces conectan R1 con .0/26 y .64/27. Verifica sus entradas y estado en show ip route."},
  {q: "¿Cómo registras una prueba con 4 enviados y 0 recibidos?", a: ["Cambias el valor a 4 porque era lo esperado", "Conservas 0, describes el síntoma y diagnosticas", "Eliminas la prueba de la bitácora"], ok: 1, why: "El resultado real permite comparar antes y después. Revisa configuración, trayecto y retorno con una hipótesis verificable."},
  {q: "¿Qué indica un primer eco perdido seguido de respuestas al repetir?", a: ["Siempre significa cable dañado", "Puede estar asociado al aprendizaje ARP; verifica una serie final", "Demuestra que todas las aplicaciones funcionan"], ok: 1, why: "La resolución del siguiente salto puede afectar el primer intento. Conserva la serie final y registra el contexto sin asumir una causa única."},
  {q: "Corriges el gateway de OPE1. ¿Qué pruebas después?", a: ["Solo miras el LED", "Repites el trayecto fallido y otro que funcionaba", "Cambias todas las VLAN"], ok: 1, why: "La reprueba comprueba la recuperación y la regresión verifica que la comunicación previa sigue funcionando."},
  {q: "El switch real tiene Gi1/0/3. ¿Cómo aplicas la guía?", a: ["Usas Fa0/3 aunque no exista", "Identificas el puerto físico y adaptas el comando", "Cambias la IP por el número del puerto"], ok: 1, why: "Consulta el modelo, la interfaz y el cableado. Registra el puerto real con la VLAN del diseño."},
  {q: "¿Qué confirma un ping exitoso?", a: ["Alcance ICMP y retorno en ese trayecto", "El rendimiento para todos los usuarios", "La disponibilidad de cualquier aplicación"], ok: 0, why: "Para el proyecto completo se necesitan pruebas específicas de los servicios, disponibilidad y desempeño requeridos."},
  {q: "¿Por qué guardas running-config en startup-config?", a: ["Para conservar la configuración al reiniciar", "Para calcular la máscara", "Para generar las VLAN en los PC"], ok: 0, why: "Running-config es la configuración activa. La copia a startup-config permite recuperarla después de reiniciar el dispositivo."}
];
questions.forEach((question, index) => {
  const box = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = "Pregunta " + (index + 1) + " · " + question.q;
  box.append(legend);
  const result = document.createElement("p");
  result.setAttribute("role", "status");
  result.setAttribute("aria-live", "polite");
  question.a.forEach((answer, choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer";
    button.textContent = answer;
    button.addEventListener("click", () => {
      result.className = "feedback";
      result.textContent = (choice === question.ok ? "Correcto. " : "Revisa tu elección. ") + question.why;
    });
    box.append(button);
  });
  box.append(result);
  select("#quiz").append(box);
});

selectAll(".copy").forEach(button => button.addEventListener("click", async () => {
  const code = button.parentElement.querySelector("code");
  try {
    await navigator.clipboard.writeText(code.textContent);
    button.textContent = "Comandos copiados";
  } catch {
    const range = document.createRange();
    range.selectNodeContents(code);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    button.textContent = "Bloque seleccionado. Copia con Ctrl+C";
  }
}));

function review() {
  const data = snapshot();
  const missing = fields.filter(field => !field.value.trim());
  const messages = missing.map(field => {
    const activity = field.closest("section").querySelector("h2").textContent;
    const group = field.closest("fieldset")?.querySelector("legend")?.textContent || "Reflexión";
    return {key: field.dataset.field, text: activity + " · " + group + " · " + label(field)};
  });
  subnetIssues(data).filter(([key]) => data[key]?.trim()).forEach(([key]) => {
    messages.push({key, text: "Revisa el valor de " + label(byKey.get(key)) + " en " + (key.startsWith("adm-") ? "Administración." : "Operaciones.")});
  });
  pcIssues(data).filter(issue => data[issue.key]?.trim()).forEach(issue => messages.push({key: issue.key, text: issue.message}));
  testPlan.forEach(test => {
    const result = testResult(test, data);
    if (!result.complete && !result.text.startsWith("Registro pendiente")) messages.push({key: test.id + "-sent", text: test.id.toUpperCase() + " · " + result.text});
  });
  const target = select("#review-result");
  target.replaceChildren();
  const summary = document.createElement("p");
  summary.textContent = messages.length
    ? "Hay " + messages.length + " campos o comprobaciones por revisar. Selecciona un pendiente para ir al campo."
    : "Los registros están completos y las comprobaciones de consistencia pasan. Contrasta cada dato con tus archivos de evidencia.";
  target.append(summary);
  const list = document.createElement("ul");
  messages.forEach(item => {
    const row = document.createElement("li");
    const link = document.createElement("a");
    link.href = "#" + item.key;
    link.textContent = item.text;
    link.addEventListener("click", () => {
      const field = byKey.get(item.key);
      const details = field.closest("details");
      if (details) details.open = true;
      field.focus();
    });
    row.append(link);
    list.append(row);
  });
  target.append(list);
  return messages;
}
select("#review").addEventListener("click", review);

function reportMarkdown() {
  const lines = ["# Bitácora de práctica de redes", "", "Ficha 3399813 · RA 4", ""];
  selectAll("section.lesson").forEach(section => {
    const localFields = Array.from(section.querySelectorAll("[data-field]"));
    if (!localFields.length) return;
    lines.push("## " + section.querySelector("h2").textContent, "");
    let previous = "";
    localFields.forEach(field => {
      const group = field.closest("fieldset")?.querySelector("legend")?.textContent ||
        field.closest("details")?.querySelector("summary")?.textContent || "";
      if (group && group !== previous) { lines.push("### " + group, ""); previous = group; }
      lines.push("**" + label(field) + "**", "", field.value.trim() || "(Pendiente de completar)", "");
    });
  });
  lines.push("## Estado de las pruebas", "");
  testPlan.forEach(test => lines.push("- " + test.id.toUpperCase() + ". " + testResult(test, snapshot()).text));
  if (Object.keys(legacyNotes).length) lines.push("", "## Apuntes de la versión anterior", "", select("#legacy").textContent);
  return lines.join("\n");
}

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], {type}));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
select("#download").addEventListener("click", () => {
  download("bitacora-redes-RA4.md", reportMarkdown(), "text/markdown;charset=utf-8");
});
select("#backup").addEventListener("click", () => {
  download("respaldo-bitacora-RA4.json", JSON.stringify({version: 2, fields: snapshot(), legacy: legacyNotes}, null, 2), "application/json");
});

function parseBackup(text) {
  const data = JSON.parse(text);
  if (!data || data.version !== 2 || !data.fields || Array.isArray(data.fields) || typeof data.fields !== "object") {
    throw new Error("El archivo debe ser un respaldo JSON de esta versión de la guía.");
  }
  const clean = {};
  fields.forEach(field => {
    const raw = data.fields[field.dataset.field];
    if (raw === undefined) { clean[field.dataset.field] = ""; return; }
    if (typeof raw !== "string" || raw.length > 50000) throw new Error("El respaldo contiene un campo incompatible.");
    if (field.tagName === "SELECT" && !Array.from(field.options).some(option => option.value === raw)) {
      throw new Error("Una selección del respaldo no corresponde a esta guía.");
    }
    clean[field.dataset.field] = raw;
  });
  if (!Object.keys(data.fields).some(key => byKey.has(key))) throw new Error("El respaldo no contiene campos reconocidos.");
  const legacy = {};
  if (data.legacy && typeof data.legacy === "object" && !Array.isArray(data.legacy)) {
    Object.entries(data.legacy).forEach(([key, raw]) => {
      if (typeof raw === "string" && raw.length <= 50000) legacy[key] = raw;
    });
  }
  return {fields: clean, legacy};
}

select("#restore").addEventListener("change", async event => {
  const file = event.target.files[0];
  const preview = select("#import-preview");
  preview.replaceChildren();
  preview.hidden = true;
  pendingImport = null;
  if (!file) return;
  try {
    if (file.size > 2000000) throw new Error("El archivo supera el tamaño admitido para una bitácora.");
    pendingImport = parseBackup(await file.text());
    const message = document.createElement("p");
    message.textContent = "Respaldo válido con " + Object.values(pendingImport.fields).filter(text => text.trim()).length + " campos diligenciados. Confirma para reemplazar los datos actuales.";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Cargar este respaldo";
    button.addEventListener("click", () => {
      if (!pendingImport) return;
      applyValues(pendingImport.fields);
      legacyNotes = pendingImport.legacy;
      save();
      showLegacy();
      refreshTests();
      select("#review-result").replaceChildren();
      preview.hidden = true;
      pendingImport = null;
      select("#transfer-status").textContent = "Respaldo cargado. Puedes continuar la práctica.";
      event.target.value = "";
    });
    preview.append(message, button);
    preview.hidden = false;
    select("#transfer-status").textContent = "";
  } catch (error) {
    select("#transfer-status").textContent = "No se cargó el archivo. " + error.message;
  }
});

select("#print").addEventListener("click", () => {
  const printable = document.createElement("article");
  printable.className = "print-report";
  const title = document.createElement("h1");
  title.textContent = "Bitácora de práctica de redes";
  const content = document.createElement("pre");
  content.textContent = reportMarkdown();
  printable.append(title, content);
  document.body.append(printable);
  const cleanup = () => printable.remove();
  window.addEventListener("afterprint", cleanup, {once: true});
  window.print();
});

