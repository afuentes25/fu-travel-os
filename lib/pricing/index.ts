import { departurePoints, travels } from "@/data/demo";
import type { BookingBoardingSnapshot, CartLine, PricedCartLine } from "@/types";

export function formatMoney(amount:number,currency:"MXN"|"USD"){return new Intl.NumberFormat("es-MX",{style:"currency",currency,maximumFractionDigits:0}).format(amount)+" "+currency}
export function priceLine(line: CartLine): PricedCartLine {
  const travel=travels.find(t=>t.id===line.travelId && t.agencyId===line.agencyId);
  if(!travel) throw new Error("El viaje no pertenece a la agencia.");
  const departure=travel.departures.find(d=>d.id===line.departureId && d.saleStatus!=="sold_out" && d.availableSpaces>=line.travelers);
  if(!departure) throw new Error("La salida ya no está disponible.");
  if(!line.boardingOptionId) throw new Error("Debes seleccionar y confirmar un punto de abordaje.");
  const option=departure.boardingOptions.find(b=>b.id===line.boardingOptionId && b.status!=="sold_out" && b.status!=="disabled");
  if(!option) throw new Error("El punto no es válido para esta salida.");
  const point=departurePoints.find(p=>p.id===option.agencyDeparturePointId && p.agencyId===line.agencyId);
  const rate=travel.pricingOptions.find(p=>p.id===line.pricingOptionId);
  if(!point||!rate||rate.currency!==travel.basePrice.currency) throw new Error("Configuración de tarifa inválida.");
  const selectedExtras=travel.extras.filter(e=>line.extraIds.includes(e.id));
  const subtotal=rate.amount*line.travelers;
  const taxes=(travel.basePrice.taxesIncluded?0:(rate.taxesAmount??travel.basePrice.taxesAmount??0))*line.travelers;
  const surcharge=(option.surchargeAmount??0)*(option.surchargeType==="per_booking"?1:line.travelers);
  const extrasTotal=selectedExtras.reduce((sum,e)=>sum+e.price*(e.pricingMode==="per_person"?line.travelers:1),0);
  const boarding:BookingBoardingSnapshot={boardingOptionId:option.id,boardingPointId:point.id,pointName:point.name,address:point.address,reference:point.reference,city:point.city,meetingTime:option.meetingTime,departureTime:option.departureTime,surchargeAmount:option.surchargeAmount??0,surchargeType:option.surchargeType??"per_person",currency:option.currency??travel.basePrice.currency,instructions:option.instructionsOverride??point.instructions};
  return {...line,boardingOptionId:option.id,boardingSnapshot:boarding,travel,departure,boarding,subtotal,taxes,surcharge,extrasTotal,total:subtotal+taxes+surcharge+extrasTotal,deposit:(travel.basePrice.depositAmount??subtotal)*line.travelers};
}
export function priceLinePending(line:CartLine){
  const travel=travels.find(t=>t.id===line.travelId&&t.agencyId===line.agencyId);
  if(!travel)throw new Error("El viaje no pertenece a la agencia.");
  const departure=travel.departures.find(d=>d.id===line.departureId&&d.saleStatus!=="sold_out"&&d.availableSpaces>=line.travelers);
  const rate=travel.pricingOptions.find(p=>p.id===line.pricingOptionId);
  if(!departure||!rate||rate.currency!==travel.basePrice.currency)throw new Error("Configuración de reserva inválida.");
  const extras=travel.extras.filter(e=>line.extraIds.includes(e.id));
  const subtotal=rate.amount*line.travelers;
  const taxes=(travel.basePrice.taxesIncluded?0:(rate.taxesAmount??travel.basePrice.taxesAmount??0))*line.travelers;
  const extrasTotal=extras.reduce((sum,e)=>sum+e.price*(e.pricingMode==="per_person"?line.travelers:1),0);
  return {travel,departure,subtotal,taxes,extrasTotal,total:subtotal+taxes+extrasTotal,deposit:(travel.basePrice.depositAmount??subtotal)*line.travelers};
}
export function confirmBoardingPoint(line:CartLine,boardingOptionId:string):CartLine{
  const travel=travels.find(t=>t.id===line.travelId&&t.agencyId===line.agencyId);
  const departure=travel?.departures.find(d=>d.id===line.departureId);
  const option=departure?.boardingOptions.find(b=>b.id===boardingOptionId&&b.status!=="sold_out"&&b.status!=="disabled");
  const point=option&&departurePoints.find(p=>p.id===option.agencyDeparturePointId&&p.agencyId===line.agencyId&&p.isActive);
  if(!travel||!departure||!option||!point)throw new Error("El punto no es válido para esta salida.");
  const snapshot:BookingBoardingSnapshot={boardingOptionId:option.id,boardingPointId:point.id,pointName:point.name,address:point.address,reference:point.reference,city:point.city,meetingTime:option.meetingTime,departureTime:option.departureTime,surchargeAmount:option.surchargeAmount??0,surchargeType:option.surchargeType??"per_person",currency:option.currency??travel.basePrice.currency,instructions:option.instructionsOverride??point.instructions};
  return {...line,boardingOptionId:option.id,boardingSnapshot:snapshot};
}
export function validateCart(lines:CartLine[]){const priced=lines.map(priceLine);if(new Set(priced.map(x=>x.agencyId)).size>1)throw new Error("No puedes mezclar agencias.");if(new Set(priced.map(x=>x.travel.basePrice.currency)).size>1)throw new Error("No puedes mezclar monedas.");return priced}
