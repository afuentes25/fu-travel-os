import test from "node:test";
import assert from "node:assert/strict";
import { agencies, travels } from "../data/demo/index";
import { filterCatalog } from "../lib/catalog/index";
import { formatMoney, priceLine, validateCart } from "../lib/pricing/index";
import { normalizeHostname, resolveTenant, resolveTheme } from "../lib/tenancy/index";

test("resuelve tenant por hostname, query demo y fallback local",()=>{
  assert.equal(resolveTenant("FURIVER.TRAVEL.FU.LAND:443").slug,"furiver");
  assert.equal(resolveTenant("localhost:3000","crisenix").slug,"crisenix");
  assert.equal(resolveTenant("dominio-invalido.test").slug,"furiver");
  assert.equal(normalizeHostname("https://AgenciaEjemplo.com/"),"agenciaejemplo.com");
});
test("query válida de tema tiene prioridad",()=>assert.equal(resolveTheme(agencies[0],"boutique"),"boutique"));
test("catálogo busca, filtra y ordena sin mutar origen",()=>{
  const own=travels.filter(t=>t.agencyId===agencies[1].id);
  assert.equal(filterCatalog(own,{q:"Europa"}).length,1);
  assert.ok(filterCatalog(own,{currency:"USD"}).every(t=>t.basePrice.currency==="USD"));
  assert.deepEqual(filterCatalog(own,{sort:"price-asc"}).map(t=>t.basePrice.amount),[...filterCatalog(own,{sort:"price-asc"}).map(t=>t.basePrice.amount)].sort((a,b)=>a-b));
});
test("precio recalcula tarifa, impuesto, extra, suplemento y snapshot",()=>{
  const travel=travels.find(t=>t.departures[0].boardingOptions.length>0)!;
  const dep=travel.departures[0];const board=dep.boardingOptions[0];
  const priced=priceLine({id:"x",agencyId:travel.agencyId,travelId:travel.id,departureId:dep.id,boardingOptionId:board.id,pricingOptionId:travel.pricingOptions[0].id,travelers:2,extraIds:[travel.extras[0].id]});
  assert.ok(priced.total>=priced.subtotal);
  assert.ok(priced.boarding.pointName);
  assert.match(formatMoney(priced.total,travel.basePrice.currency),/(MXN|USD)/);
});
test("carrito bloquea mezcla de agencias y precios manipulados no forman parte del modelo",()=>{
  const line=(t:typeof travels[number])=>({id:t.id,agencyId:t.agencyId,travelId:t.id,departureId:t.departures[0].id,boardingOptionId:t.departures[0].boardingOptions[0].id,pricingOptionId:t.pricingOptions[0].id,travelers:1,extraIds:[]});
  assert.throws(()=>validateCart([line(travels[0]),line(travels[4])]),/mezclar agencias/);
  assert.equal("price" in line(travels[0]),false);
});
test("punto de otra salida y punto agotado se rechazan",()=>{
  const t=travels[0]; const invalid={id:"bad",agencyId:t.agencyId,travelId:t.id,departureId:t.departures[0].id,boardingOptionId:"otro",pricingOptionId:t.pricingOptions[0].id,travelers:1,extraIds:[]};
  assert.throws(()=>priceLine(invalid),/punto/);
});
