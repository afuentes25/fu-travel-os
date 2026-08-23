import "server-only";

import { resolveCustomerAgencyAccess } from "@/lib/customers/customer-access";

import { createAcceptanceCertificateService, type EnsureAcceptanceCertificateResult } from "./acceptance-certificate-core";
import { renderAcceptanceCertificatePdf } from "./acceptance-certificate-pdf";
import { createSupabaseAcceptanceCertificateRepository } from "./acceptance-certificate-repository";
import { createSupabaseAcceptanceCertificateStorage } from "./acceptance-certificate-storage";

export * from "./acceptance-certificate-core";

export async function ensureAcceptanceCertificateDocument(input: Readonly<{ requestedAgencySlug?: unknown; reservationId: unknown }>): Promise<EnsureAcceptanceCertificateResult> {
  return createAcceptanceCertificateService({
    resolveAccess: resolveCustomerAgencyAccess,
    repository: () => createSupabaseAcceptanceCertificateRepository(),
    storage: () => createSupabaseAcceptanceCertificateStorage(),
    renderPdf: renderAcceptanceCertificatePdf,
  }).ensure(input);
}
