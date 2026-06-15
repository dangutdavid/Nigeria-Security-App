import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CitizenReportMap } from "@/components/CitizenReportMap";
import { CitizenIncidentReceipt } from "@/services/citizenIncidentApi";
import { listReportsByAgency } from "@/services/reportRepository";

export default function VioMapScreen() {
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<CitizenIncidentReceipt[]>([]);

  useFocusEffect(
    useCallback(() => {
      void listReportsByAgency("vio").then(setReports);
    }, []),
  );

  return (
    <CitizenReportMap
      title="VIO Location View"
      subtitle="VIO-routed roadworthiness and vehicle safety reports with GPS-ready locations and manual fallback."
      reports={reports}
      accentColor="#7B3F00"
      bottomPadding={insets.bottom + 110}
      detailRouteForReport={() => "/(vio)/inspections"}
    />
  );
}
