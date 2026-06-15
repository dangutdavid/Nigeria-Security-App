import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CitizenReportMap } from "@/components/CitizenReportMap";
import { CitizenIncidentReceipt } from "@/services/citizenIncidentApi";
import { listReportsByAgency } from "@/services/reportRepository";

export default function PoliceMapScreen() {
  const insets = useSafeAreaInsets();
  const [reports, setReports] = useState<CitizenIncidentReceipt[]>([]);

  useFocusEffect(
    useCallback(() => {
      void listReportsByAgency("police").then(setReports);
    }, []),
  );

  return (
    <CitizenReportMap
      title="Police Location View"
      subtitle="Police-routed citizen reports with GPS-ready locations and manual-location fallback for reports without coordinates."
      reports={reports}
      accentColor="#1A3A6C"
      bottomPadding={insets.bottom + 110}
      detailRouteForReport={() => "/(police)/crime-reports"}
    />
  );
}
