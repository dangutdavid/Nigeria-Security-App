import React from "react";
import { Image, StyleSheet, View } from "react-native";
import Svg, { Circle, G, Path, Polygon, Rect, Text as SvgText } from "react-native-svg";

export type AgencyEmblemId = "frsc" | "police" | "vio";

const FRSC_LOGO = require("../assets/images/logo-frsc.jpg");
const NPF_LOGO = require("../assets/images/logo-npf.jpg");

function pts(cx: number, cy: number, r: number, sides: number, offsetDeg = 0): string {
  return Array.from({ length: sides }, (_, i) => {
    const a = ((i * 360) / sides + offsetDeg) * (Math.PI / 180);
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");
}

function VIOEmblem({ size }: { size: number }) {
  const hexOuter = pts(50, 50, 45, 6, -90);
  const hexInner = pts(50, 50, 37, 6, -90);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Polygon points={hexOuter} fill="#7B3F00" stroke="rgba(255,255,255,0.9)" strokeWidth={2} />
      <Polygon points={hexInner} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
      <G transform="translate(24, 30)">
        <Rect x={0} y={8} width={38} height={13} rx={3} fill="none" stroke="white" strokeWidth={2.2} />
        <Path d="M 6,8 L 12,2 L 26,2 L 32,8" fill="none" stroke="white" strokeWidth={2.2} strokeLinejoin="round" />
        <Circle cx={9} cy={21} r={4} fill="none" stroke="white" strokeWidth={2} />
        <Circle cx={29} cy={21} r={4} fill="none" stroke="white" strokeWidth={2} />
        <Path d="M 13,8 L 15,3.5 L 23,3.5 L 25,8" fill="rgba(255,255,255,0.18)" />
      </G>
      <Path d="M 58,30 L 63,38 L 73,24" stroke="#66BB6A" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <SvgText x={50} y={75} textAnchor="middle" fontSize={7.5} fontWeight="bold" fill="white" letterSpacing={3}>VIO</SvgText>
    </Svg>
  );
}

export function AgencyEmblem({ agency, size = 80 }: { agency: AgencyEmblemId; size?: number }) {
  if (agency === "vio") {
    return <VIOEmblem size={size} />;
  }

  const source = agency === "police" ? NPF_LOGO : FRSC_LOGO;

  return (
    <View style={[styles.imgWrap, { width: size, height: size }]}>
      <Image
        source={source}
        style={styles.img}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  imgWrap: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  img: {
    width: "100%",
    height: "100%",
  },
});
