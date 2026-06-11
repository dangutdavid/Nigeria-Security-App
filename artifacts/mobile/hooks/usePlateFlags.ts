import { useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useReferrals, type Referral } from "@/context/ReferralContext";
import { useTheftReports, type TheftReport } from "@/context/TheftReportContext";
import { normalizePlate } from "@/lib/plate";

export interface PlateFlags {
  theftMatches: TheftReport[];
  referrals: Referral[];
  hasFlags: boolean;
}

/**
 * Cross-agency plate intelligence. Given a plate, surfaces:
 *  - active stolen-vehicle reports from the shared theft registry (globally
 *    shared — every agency contributes to and reads the same registry)
 *  - open cross-agency referrals that reference the same plate, BUT only those
 *    the viewer's agency is a party to (sender or recipient). Referrals are
 *    directed, explicit shares — they are not broadcast to uninvolved agencies.
 *
 * Agency-neutral and offline-first; reads from the shared local stores.
 */
export function usePlateFlags(plate: string): PlateFlags {
  const { user } = useAuth();
  const { reports } = useTheftReports();
  const { openReferralsByPlate } = useReferrals();

  return useMemo(() => {
    const norm = normalizePlate(plate);
    if (!norm) return { theftMatches: [], referrals: [], hasFlags: false };
    const theftMatches = reports.filter(
      (r) => r.status === "active" && normalizePlate(r.plate) === norm,
    );
    const referrals = user
      ? openReferralsByPlate(plate).filter(
          (r) => r.fromAgency === user.agency || r.toAgency === user.agency,
        )
      : [];
    return {
      theftMatches,
      referrals,
      hasFlags: theftMatches.length > 0 || referrals.length > 0,
    };
  }, [plate, reports, openReferralsByPlate, user]);
}
