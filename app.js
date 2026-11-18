"use strict";
const $ = s => document.querySelector(s);
const all = s => Array.from(document.querySelectorAll(s));
const quizzes = [
 {q:"¿Qué máscara permite al menos 50 hosts utilizables?",a:["/27, con 30 hosts","/26, con 62 hosts","/28, con 14 hosts"],ok:1,why:"Con 6 bits de host, 2⁶ − 2 = 62. El prefijo es 32 − 6 = /26."},
 {q:"¿Para qué sirve el enlace troncal S1–R1?",a:["Transporta las VLAN 10 y 20","Entrega direcciones IP automáticamente","Sustituye la máscara del PC"],ok:0,why:"El troncal lleva tráfico de varias VLAN. La etiqueta 802.1Q permite reconocer cada VLAN."},
 {q:"¿Qué gateway debe usar OPE1 con IP 192.168.10.66/27?",a:["192.168.10.1","192.168.10.95","192.168.10.65"],ok:2,why:"La subred es .64/27. La interfaz de R1 en esa subred usa .65. La dirección .95 es broadcast."},
 {q:"ADM1 alcanza ADM2 pero falla hacia Operaciones. ¿Qué revisarías?",a:["Solo el nombre del PC","Gateway, troncal y subinterfaces, usando el diseño","Cambiar todas las IP sin comprobar"],ok:1,why:"El trayecto local funciona. Compara los parámetros del paso entre redes y prueba cada puerta de enlace para acotar la falla."}
];
quizzes.forEach((item,i)=>{
 const block=document.createElement("div");
 const heading=document.createElement("h3");heading.textContent=item.q;block.append(heading);
 const result=document.createElement("p");result.setAttribute("role","status");result.setAttribute("aria-live","polite");
 item.a.forEach((text,j)=>{
  const b=document.createElement("button");b.type="button";b.className="answer";b.textContent=text;
  b.addEventListener("click",()=>{result.className="feedback";result.textContent=(j===item.ok?"Respuesta correcta. ":"Revisa tu respuesta. ")+item.why;});block.append(b);
 });block.append(result);$("#quiz").append(block);
});
function validateSubnets(admin,oper){
 const normalize = text => text.trim().replace(/\s/g,"");
 if(normalize(admin)==="192.168.10.0/26" && normalize(oper)==="192.168.10.64/27")
  return {ok:true,text:"Las dos subredes son correctas. Administración admite 62 hosts y Operaciones 30. Calcula ahora las máscaras, el broadcast y las direcciones de cada PC."};
 return {ok:false,text:"Revisa capacidad y límites. Administración requiere un bloque de 64 direcciones. El siguiente bloque empieza en .64 y Operaciones requiere 32 direcciones. Introduce la dirección de red seguida del prefijo."};
}
$("#subnet").addEventListener("submit",e=>{e.preventDefault();const result=validateSubnets($("#admin").value,$("#oper").value);$("#subnet-result").textContent=result.text;});
all(".copy").forEach(button=>button.addEventListener("click",async()=>{
 const text=button.parentElement.querySelector("code").textContent;
 try{await navigator.clipboard.writeText(text);button.textContent="Copiado";}
 catch{button.textContent="Selecciona el bloque para copiar";const range=document.createRange();range.selectNodeContents(button.parentElement.querySelector("code"));const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);}
}));
const key="ra4-practica-redes-v1";
let stored={};
try{stored=JSON.parse(localStorage.getItem(key)||"{}");if(!stored||typeof stored!=="object")stored={};}
catch{$("#save-status").textContent="El guardado local no está disponible. Descarga tu bitácora para conservarla.";}
function progress(){const checks=all(".checks input");$("#progress").textContent=checks.filter(c=>c.checked).length+" de "+checks.length+" evidencias revisadas.";}
all("[data-save]").forEach(field=>{
 const value=stored[field.dataset.save];
 if(field.type==="checkbox")field.checked=value===true;
 else if(typeof value==="string")field.value=value;
 field.addEventListener("input",()=>{
  stored[field.dataset.save]=field.type==="checkbox"?field.checked:field.value;
  try{localStorage.setItem(key,JSON.stringify(stored));$("#save-status").textContent="Cambios guardados en este navegador.";}
  catch{$("#save-status").textContent="Descarga tu bitácora para conservar los cambios.";}
  progress();
 });
});
progress();
$("#download").addEventListener("click",()=>{
 const values=all("[data-save]").filter(f=>f.type!=="checkbox").map(f=>f.parentElement.firstChild.textContent.trim()+"\n"+f.value);
 const review=all(".checks input").map(f=>(f.checked?"[x] ":"[ ] ")+f.parentElement.textContent.trim());
 const text="BITÁCORA DE PRÁCTICA DE REDES\nFicha 3399813 · RA 4\n\n"+values.join("\n\n")+"\n\nREVISIÓN\n"+review.join("\n");
 const url=URL.createObjectURL(new Blob([text],{type:"text/plain;charset=utf-8"}));
 const a=document.createElement("a");a.href=url;a.download="bitacora-redes-RA4.txt";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
$("#print").addEventListener("click",()=>{all("details").forEach(d=>d.open=true);window.print();});

