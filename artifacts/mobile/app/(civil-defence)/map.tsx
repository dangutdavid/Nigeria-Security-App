import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CitizenReportMap } from "@/components/CitizenReportMap";
import { CitizenIncidentReceipt } from "@/services/citizenIncidentApi";
import { listReportsByAgency } from "@/services/reportRepository";

export default function CivilDefenceMapScreen() {
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<CitizenIncidentReceipt[]>([]);

  useFocusEffect(
    useCallback(() => {
      void listReportsByAgency("civil_defence").then(setReports);
    }, []),
  );

  return (
    <CitizenReportMap
      title="NSCDC Location View"
      subtitle="Citizen reports routed to Civil Defence with GPS pins where available and manual-location fallback where needed."
      reports={reports}
      accentColor="#234E2A"
      bottomPadding={insets.bottom + 110}
      detailRouteForReport={() => "/(civil-defence)/incidents"}
    />
  );
}
