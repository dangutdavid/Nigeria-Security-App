import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CitizenReportMap } from "@/components/CitizenReportMap";
import { CitizenIncidentReceipt } from "@/services/citizenIncidentApi";
import { listReports } from "@/services/reportRepository";

export default function AdminMapScreen() {
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<CitizenIncidentReceipt[]>([]);

  useFocusEffect(
    useCallback(() => {
      void listReports().then(setReports);
    }, []),
  );

  return (
    <CitizenReportMap
      title="National Incident Map"
      subtitle="Admin cross-agency view of all citizen reports, including GPS-ready reports and manual-location fallbacks."
      reports={reports}
      accentColor="#344054"
      bottomPadding={insets.bottom + 110}
      showAgencyFilter
      detailRouteForReport={() => "/(admin)/incidents"}
    />
  );
}
