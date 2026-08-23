import "server-only";
import { resolveCustomerAgencyAccess } from "@/lib/customers/customer-access";
import { createSupabaseReservationContractDocumentStorage } from "@/lib/documents/reservation-contract-document-storage";
import { createCustomerContractAcceptanceService, type AcceptCustomerContractResult } from "./customer-contract-acceptance-core";
import { createSupabaseCustomerContractAcceptanceRepository } from "./customer-contract-acceptance-repository";
export * from "./customer-contract-acceptance-core";
export async function acceptCustomerReservationContract(input:{requestedAgencySlug?:unknown;reservationId:unknown}):Promise<AcceptCustomerContractResult>{return createCustomerContractAcceptanceService({resolveAccess:resolveCustomerAgencyAccess,repository:()=>createSupabaseCustomerContractAcceptanceRepository(),storage:()=>createSupabaseReservationContractDocumentStorage()}).accept(input);}
