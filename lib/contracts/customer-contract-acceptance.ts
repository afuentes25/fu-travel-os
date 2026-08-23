import "server-only";
import { resolveCustomerAgencyAccess } from "@/lib/customers/customer-access";
import { ensureAcceptanceCertificateDocument } from "@/lib/documents/acceptance-certificate";
import { createSupabaseReservationContractDocumentStorage } from "@/lib/documents/reservation-contract-document-storage";
import { createCustomerContractAcceptanceService, type AcceptCustomerContractResult } from "./customer-contract-acceptance-core";
import { createSupabaseCustomerContractAcceptanceRepository } from "./customer-contract-acceptance-repository";
export * from "./customer-contract-acceptance-core";
export async function acceptCustomerReservationContract(input:{requestedAgencySlug?:unknown;reservationId:unknown}):Promise<AcceptCustomerContractResult>{const result=await createCustomerContractAcceptanceService({resolveAccess:resolveCustomerAgencyAccess,repository:()=>createSupabaseCustomerContractAcceptanceRepository(),storage:()=>createSupabaseReservationContractDocumentStorage()}).accept(input);if(result.status!=="accepted"&&result.status!=="already_accepted")return result;let certificateStatus:"generated"|"existing"|"document_error"="document_error";try{const certificate=await ensureAcceptanceCertificateDocument(input);if(certificate.status==="generated"||certificate.status==="existing")certificateStatus=certificate.status;}catch{/* Acceptance is durable even if the document projection fails. */}return{...result,acceptance:{...result.acceptance,certificateStatus}};}
