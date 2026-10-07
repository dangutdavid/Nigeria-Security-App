import QRCode from "qrcode";
import React, { useMemo } from "react";
import { View } from "react-native";

/**
 * QR code drawn with plain Views (no react-native-svg), so it works in Expo Go
 * and in already-installed builds without a native rebuild. Consecutive dark
 * modules in a row are merged into one View to keep the element count low.
 */
export function QrCode({ value, size = 200 }: { value: string; size?: number }) {
  const rows = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: "M" });
    const n = qr.modules.size;
    const data = qr.modules.data;
    const out: Array<Array<{ start: number; length: number }>> = [];
    for (let y = 0; y < n; y++) {
      const runs: Array<{ start: number; length: number }> = [];
      let x = 0;
      while (x < n) {
        if (data[y * n + x]) {
          const start = x;
          while (x < n && data[y * n + x]) x++;
          runs.push({ start, length: x - start });
        } else x++;
      }
      out.push(runs);
    }
    return { n, out };
  }, [value]);

  const quiet = 4; // quiet-zone modules required by scanners
  const cell = size / (rows.n + quiet * 2);
  return (
    <View
      accessible
      accessibilityLabel="QR code for your authenticator app"
      style={{ width: size, height: size, backgroundColor: "#FFFFFF", padding: cell * quiet }}
    >
      {rows.out.map((runs, y) => (
        <View key={y} style={{ height: cell, flexDirection: "row" }}>
          {runs.map((run) => (
            <View
              key={run.start}
              style={{ position: "absolute", left: run.start * cell, width: run.length * cell + 0.5, height: cell + 0.5, backgroundColor: "#000000" }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
