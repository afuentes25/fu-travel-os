import { agencies, departurePoints, travels } from "@/data/demo";
import { toMinorUnits } from "@/lib/fx";
import { resolveRoomCapacityPolicy, validateRoomCapacity } from "@/lib/room-capacity";
import { getEffectiveRateAmount, getEffectiveTaxesPerTraveler } from "@/lib/trip-sections";
import type { BookingBoardingSnapshot, CartLine, DepositPolicy, PricedCartLine } from "@/types";

export function isDepartureBookable(
  departure: PricedCartLine["departure"],
  now: Date = new Date(),
) {
  const today = now.toISOString().slice(0, 10);
  return (
    departure.saleStatus !== "sold_out" &&
    departure.startDate.slice(0, 10) >= today
  );
}

export function formatMoney(amount: number, currency: "MXN" | "USD") {
  return (
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      maximumFractionDigits: 0,
    }).format(amount) + ` ${currency}`
  );
}
export function resolveDepositAmount({
  policy,
  total,
  fallbackPerTraveler,
  travelers,
}: {
  policy?: DepositPolicy;
  total: number;
  fallbackPerTraveler: number;
  travelers: number;
}) {
  if (!policy?.enabled) return fallbackPerTraveler * travelers;
  if (policy.type === "fixed")
    return Math.max(policy.fixedAmount ?? fallbackPerTraveler, policy.minimumAmount ?? 0);
  return Math.max(
    total * ((policy.percentage ?? 100) / 100),
    policy.minimumAmount ?? 0,
  );
}
const depositPolicyFor = (travel: PricedCartLine["travel"], departure: PricedCartLine["departure"]) =>
  departure.depositPolicy ??
  departure.pricing?.pricingOverrides?.depositPolicy ??
  travel.depositPolicy;

export function validateCartCurrencies(lines: CartLine[]) {
  const currencies = new Set(
    lines.map((line) => {
      const travel = travels.find(
        (item) => item.id === line.travelId && item.agencyId === line.agencyId,
      );
      if (!travel) throw new Error("El viaje no pertenece a la agencia.");
      return travel.basePrice.currency;
    }),
  );
  if (currencies.size > 1) throw new Error("No puedes mezclar monedas.");
  return true;
}

export function validateDemoFxOrderShape(lines: CartLine[]) {
  const orderGroups = new Set(
    lines.map(
      (line) => `${line.agencyId}:${line.travelId}:${line.departureId}`,
    ),
  );
  const foreignGroups = new Set(
    lines.flatMap((line) => {
      const travel = travels.find(
        (item) =>
          item.id === line.travelId && item.agencyId === line.agencyId,
      );
      return travel?.foreignCurrencyPricing?.convertDepositAtCheckout
        ? [`${line.agencyId}:${line.travelId}:${line.departureId}`]
        : [];
    }),
  );
  if (
    foreignGroups.size > 1 ||
    (foreignGroups.size === 1 && orderGroups.size > 1)
  )
    throw new Error(
      "La demostración procesa un viaje internacional por orden y sin otros viajes.",
    );
  return true;
}

export function validateFxGroupConsistency(lines: CartLine[]) {
  const groups = new Map<string, CartLine[]>();
  lines.forEach((line) => {
    const key = `${line.agencyId}:${line.travelId}:${line.departureId}`;
    groups.set(key, [...(groups.get(key) ?? []), line]);
  });
  groups.forEach((group) => {
    const firstLine = group[0];
    const travel = travels.find(
      (item) =>
        item.id === firstLine.travelId &&
        item.agencyId === firstLine.agencyId,
    );
    if (!travel) throw new Error("El viaje no pertenece a la agencia.");
    const foreign = travel.foreignCurrencyPricing;
    if (!foreign?.convertDepositAtCheckout) return;
    if (
      group.some(
        (line) => !line.fxSnapshot || !line.paymentAllocation,
      )
    )
      throw new Error(
        "La reserva internacional requiere una cotización vigente.",
      );
    const snapshot = group[0].fxSnapshot!;
    const allocation = group[0].paymentAllocation!;
    group.forEach((line) => {
      if (
        line.fxSnapshot!.id !== snapshot.id ||
        line.paymentAllocation!.fxSnapshotId !== snapshot.id ||
        line.paymentAllocation!.contractCurrency !==
          foreign.pricingCurrency ||
        line.paymentAllocation!.chargeCurrency !==
          foreign.checkoutChargeCurrency ||
        line.fxSnapshot!.sourceCurrency !== foreign.pricingCurrency ||
        line.fxSnapshot!.chargeCurrency !==
          foreign.checkoutChargeCurrency
      )
        throw new Error(
          "Las líneas del viaje tienen cotizaciones incompatibles.",
        );
    });
    const contractTotalMinor = group.reduce((sum, line) => {
      const priced = line.boardingOptionId
        ? priceLine(line)
        : priceLinePending(line);
      return sum + toMinorUnits(priced.total, foreign.pricingCurrency);
    }, 0);
    if (
      allocation.fxSnapshotId !== snapshot.id ||
      allocation.contractTotalMinor !== contractTotalMinor ||
      allocation.contractualPaymentMinor !== snapshot.sourceAmountMinor ||
      allocation.chargeNowMinor !== snapshot.chargeAmountMinor
    )
      throw new Error("La asignación del pago no coincide con la cotización.");
  });
  return true;
}
export function priceLine(line: CartLine): PricedCartLine {
  const travel=travels.find(t=>t.id===line.travelId && t.agencyId===line.agencyId);
  if(!travel) throw new Error("El viaje no pertenece a la agencia.");
  const departure=travel.departures.find(d=>d.id===line.departureId && isDepartureBookable(d) && d.availableSpaces>=line.travelers);
  if(!departure) throw new Error("La salida ya no está disponible.");
  if(!line.boardingOptionId) throw new Error("Debes seleccionar y confirmar un punto de abordaje.");
  const option=departure.boardingOptions.find(b=>b.id===line.boardingOptionId && b.status!=="sold_out" && b.status!=="disabled");
  if(!option) throw new Error("El punto no es válido para esta salida.");
  const point=departurePoints.find(p=>p.id===option.agencyDeparturePointId && p.agencyId===line.agencyId);
  const rate=travel.pricingOptions.find(p=>p.id===line.pricingOptionId);
  if(!point||!rate||rate.currency!==travel.basePrice.currency) throw new Error("Configuración de tarifa inválida.");
  const selectedExtras=travel.extras.filter(e=>line.extraIds.includes(e.id));
  if(selectedExtras.some(extra=>extra.currency!==travel.basePrice.currency))throw new Error("La moneda del extra no coincide con la moneda contractual.");
  if((option.currency??travel.basePrice.currency)!==travel.basePrice.currency)throw new Error("La moneda del suplemento no coincide con la moneda contractual.");
  const subtotal=getEffectiveRateAmount({trip:travel,departure,rate})*line.travelers;
  const taxes=getEffectiveTaxesPerTraveler({trip:travel,departure,rate})*line.travelers;
  const surcharge=(option.surchargeAmount??0)*(option.surchargeType==="per_booking"?1:line.travelers);
  const extrasTotal=selectedExtras.reduce((sum,e)=>sum+e.price*(e.pricingMode==="per_person"?line.travelers:1),0);
  const boarding:BookingBoardingSnapshot={boardingOptionId:option.id,boardingPointId:point.id,pointName:point.name,address:point.address,reference:point.reference,city:point.city,meetingTime:option.meetingTime,departureTime:option.departureTime,surchargeAmount:option.surchargeAmount??0,surchargeType:option.surchargeType??"per_person",currency:option.currency??travel.basePrice.currency,instructions:option.instructionsOverride??point.instructions};
  const total=subtotal+taxes+surcharge+extrasTotal;
  return {...line,boardingOptionId:option.id,boardingSnapshot:boarding,travel,departure,boarding,subtotal,taxes,surcharge,extrasTotal,total,deposit:resolveDepositAmount({policy:depositPolicyFor(travel,departure),total,fallbackPerTraveler:travel.basePrice.depositAmount??getEffectiveRateAmount({trip:travel,departure,rate}),travelers:line.travelers})};
}
export function priceLinePending(line:CartLine){
  const travel=travels.find(t=>t.id===line.travelId&&t.agencyId===line.agencyId);
  if(!travel)throw new Error("El viaje no pertenece a la agencia.");
  const departure=travel.departures.find(d=>d.id===line.departureId&&isDepartureBookable(d)&&d.availableSpaces>=line.travelers);
  const rate=travel.pricingOptions.find(p=>p.id===line.pricingOptionId);
  if(!departure||!rate||rate.currency!==travel.basePrice.currency)throw new Error("Configuración de reserva inválida.");
  const extras=travel.extras.filter(e=>line.extraIds.includes(e.id));
  if(extras.some(extra=>extra.currency!==travel.basePrice.currency))throw new Error("La moneda del extra no coincide con la moneda contractual.");
  const subtotal=getEffectiveRateAmount({trip:travel,departure,rate})*line.travelers;
  const taxes=getEffectiveTaxesPerTraveler({trip:travel,departure,rate})*line.travelers;
  const extrasTotal=extras.reduce((sum,e)=>sum+e.price*(e.pricingMode==="per_person"?line.travelers:1),0);
  const total=subtotal+taxes+extrasTotal;
  return {travel,departure,subtotal,taxes,extrasTotal,total,deposit:resolveDepositAmount({policy:depositPolicyFor(travel,departure),total,fallbackPerTraveler:travel.basePrice.depositAmount??getEffectiveRateAmount({trip:travel,departure,rate}),travelers:line.travelers})};
}
export function estimateCartLines(lines: CartLine[]) {
  return lines.map((line) => {
    try {
      return {
        line,
        estimate: line.boardingOptionId
          ? priceLine(line)
          : priceLinePending(line),
        error: "",
      };
    } catch (error) {
      return {
        line,
        estimate: null,
        error:
          error instanceof Error
            ? error.message
            : "La reserva guardada ya no es válida.",
      };
    }
  });
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
export function validateCartRoomCapacity(lines:CartLine[]){
  const groups=new Map<string,CartLine[]>();
  lines.forEach(line=>{const key=`${line.agencyId}:${line.travelId}:${line.departureId}`;groups.set(key,[...(groups.get(key)??[]),line])});
  groups.forEach(group=>{
    const first=group[0];
    const agency=agencies.find(item=>item.id===first.agencyId);
    const travel=travels.find(item=>item.id===first.travelId&&item.agencyId===first.agencyId);
    if(!agency||!travel)throw new Error("El viaje no pertenece a la agencia.");
    if(travel.accommodationMode!=="hotel_occupancy")return;
    const adultLine=group.find(line=>{const rate=travel.pricingOptions.find(item=>item.id===line.pricingOptionId);return rate&&!["child","infant"].includes(rate.occupancy)});
    const adultRate=adultLine&&travel.pricingOptions.find(item=>item.id===adultLine.pricingOptionId);
    const policy=resolveRoomCapacityPolicy(agency,travel,adultRate);
    if(!policy.enabled)return;
    const adults=group.filter(line=>{const rate=travel.pricingOptions.find(item=>item.id===line.pricingOptionId);return rate&&!["child","infant"].includes(rate.occupancy)}).reduce((sum,line)=>sum+line.travelers,0);
    const minors=group.filter(line=>travel.pricingOptions.find(item=>item.id===line.pricingOptionId)?.occupancy==="child").reduce((sum,line)=>sum+line.travelers,0);
    const infants=group.filter(line=>travel.pricingOptions.find(item=>item.id===line.pricingOptionId)?.occupancy==="infant").reduce((sum,line)=>sum+line.travelers,0);
    const result=validateRoomCapacity({adults,minors,infants,maxGuestsPerRoom:policy.defaultMaxGuestsPerRoom,adultCountsTowardCapacity:policy.adultCountsTowardCapacity,minorCountsTowardCapacity:policy.minorCountsTowardCapacity,infantCountsTowardCapacity:policy.infantCountsTowardCapacity});
    if(!result.valid)throw new Error("La cantidad de viajeros excede la capacidad máxima de la habitación.");
  });
  return true;
}
export function validateCart(lines:CartLine[]){validateCartCurrencies(lines);validateDemoFxOrderShape(lines);validateFxGroupConsistency(lines);validateCartRoomCapacity(lines);const priced=lines.map(priceLine);if(new Set(priced.map(x=>x.agencyId)).size>1)throw new Error("No puedes mezclar agencias.");return priced}
