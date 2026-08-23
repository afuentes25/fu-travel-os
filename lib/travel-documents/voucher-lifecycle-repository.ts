import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { VoucherLifecycleRepository } from "./voucher-lifecycle-core";
export function createSupabaseVoucherLifecycleRepository(supabase:SupabaseClient=getSupabaseServerClient()):VoucherLifecycleRepository{return{async hasAvailableVoucher({agencyId,reservationId}){const{data,error}=await supabase.from("reservation_documents").select("id").eq("agency_id",agencyId).eq("reservation_id",reservationId).eq("document_type","voucher").eq("status","available").maybeSingle();if(error)throw new Error();return Boolean(data);},async revokeAvailableVoucher({agencyId,reservationId}){const{error}=await supabase.from("reservation_documents").update({status:"revoked"}).eq("agency_id",agencyId).eq("reservation_id",reservationId).eq("document_type","voucher").eq("status","available");if(error)throw new Error();}};}
