import React from "react";
import Svg, { Circle, G, Path, Polygon, Rect, Text as SvgText } from "react-native-svg";

export type AgencyEmblemId = "frsc" | "police" | "vio";

function pts(cx: number, cy: number, r: number, sides: number, offsetDeg = 0): string {
  return Array.from({ length: sides }, (_, i) => {
    const a = ((i * 360) / sides + offsetDeg) * (Math.PI / 180);
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");
}

function starPts(cx: number, cy: number, rOuter: number, rInner: number, points: number, offsetDeg = -90): string {
  return Array.from({ length: points * 2 }, (_, i) => {
    const a = ((i * 180) / points + offsetDeg) * (Math.PI / 180);
    const r = i % 2 === 0 ? rOuter : rInner;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(" ");
}

function FRSCEmblem({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Outer ring */}
      <Circle cx={50} cy={50} r={46} fill="#155233" stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} />
      {/* Shield */}
      <Path
        d="M 50,12 L 78,23 L 78,52 C 78,68 50,80 50,80 C 50,80 22,68 22,52 L 22,23 Z"
        fill="#1B5E3B"
        stroke="white"
        strokeWidth={2}
      />
      {/* Road surface inside shield */}
      <Path d="M 35,72 L 50,40 L 65,72 Z" fill="rgba(255,255,255,0.08)" />
      {/* Left road edge */}
      <Path d="M 38,70 L 50,41" stroke="white" strokeWidth={2.2} strokeLinecap="round" opacity={0.9} />
      {/* Right road edge */}
      <Path d="M 62,70 L 50,41" stroke="white" strokeWidth={2.2} strokeLinecap="round" opacity={0.9} />
      {/* Center dashes */}
      <Path d="M 50,68 L 50,62" stroke="white" strokeWidth={1.5} strokeLinecap="round" opacity={0.75} />
      <Path d="M 50,57 L 50,51" stroke="white" strokeWidth={1.5} strokeLinecap="round" opacity={0.75} />
      <Path d="M 50,46 L 50,42" stroke="white" strokeWidth={1.5} strokeLinecap="round" opacity={0.75} />
      {/* Car at top of shield */}
      <G transform="translate(32, 22)">
        <Rect x={0} y={6} width={36} height={10} rx={2.5} fill="white" />
        <Path d="M 5,6 L 10,1 L 26,1 L 31,6" fill="white" />
        <Circle cx={9} cy={16} r={3.5} fill="#1B5E3B" stroke="white" strokeWidth={1.5} />
        <Circle cx={27} cy={16} r={3.5} fill="#1B5E3B" stroke="white" strokeWidth={1.5} />
      </G>
      {/* FRSC arc text bottom */}
      <SvgText
        x={50} y={92}
        textAnchor="middle"
        fontSize={7.5}
        fontWeight="bold"
        fill="rgba(255,255,255,0.8)"
        letterSpacing={3}
      >
        FRSC
      </SvgText>
    </Svg>
  );
}

function NPFEmblem({ size }: { size: number }) {
  const badge = starPts(50, 50, 45, 28, 8);
  const inner = starPts(50, 50, 42, 26, 8);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Star badge shadow layer */}
      <Polygon points={inner} fill="#12285C" />
      {/* Star badge */}
      <Polygon points={badge} fill="#1A3A6C" stroke="rgba(255,255,255,0.9)" strokeWidth={1.5} />
      {/* Center circle */}
      <Circle cx={50} cy={50} r={22} fill="#12285C" stroke="rgba(255,255,255,0.85)" strokeWidth={2} />
      {/* Eagle wings (stylised) */}
      <Path
        d="M 50,44 C 42,39 30,42 32,49 C 37,46 43,44 50,48 C 57,44 63,46 68,49 C 70,42 58,39 50,44 Z"
        fill="white"
      />
      {/* Eagle body */}
      <Path d="M 46,48 L 50,58 L 54,48" fill="white" />
      {/* Eagle head */}
      <Circle cx={50} cy={41} r={5} fill="white" />
      {/* Beak */}
      <Path d="M 53.5,42 L 57.5,44 L 53.5,45.5" fill="#DAA520" />
      {/* Eye */}
      <Circle cx={52} cy={40} r={1} fill="#1A3A6C" />
      {/* NPF text */}
      <SvgText x={50} y={74} textAnchor="middle" fontSize={7} fontWeight="bold" fill="white" letterSpacing={3}>
        NPF
      </SvgText>
    </Svg>
  );
}

function VIOEmblem({ size }: { size: number }) {
  const hexOuter = pts(50, 50, 45, 6, -90);
  const hexInner = pts(50, 50, 37, 6, -90);
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Outer hex */}
      <Polygon points={hexOuter} fill="#7B3F00" stroke="rgba(255,255,255,0.9)" strokeWidth={2} />
      {/* Inner hex ring */}
      <Polygon points={hexInner} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
      {/* Car outline */}
      <G transform="translate(24, 30)">
        <Rect x={0} y={8} width={38} height={13} rx={3} fill="none" stroke="white" strokeWidth={2.2} />
        <Path d="M 6,8 L 12,2 L 26,2 L 32,8" fill="none" stroke="white" strokeWidth={2.2} strokeLinejoin="round" />
        <Circle cx={9} cy={21} r={4} fill="none" stroke="white" strokeWidth={2} />
        <Circle cx={29} cy={21} r={4} fill="none" stroke="white" strokeWidth={2} />
        {/* Windscreen tint */}
        <Path d="M 13,8 L 15,3.5 L 23,3.5 L 25,8" fill="rgba(255,255,255,0.18)" />
      </G>
      {/* Approval tick (green) — upper right */}
      <Path
        d="M 58,30 L 63,38 L 73,24"
        stroke="#66BB6A"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* VIO label */}
      <SvgText x={50} y={75} textAnchor="middle" fontSize={7.5} fontWeight="bold" fill="white" letterSpacing={3}>
        VIO
      </SvgText>
    </Svg>
  );
}

export function AgencyEmblem({ agency, size = 80 }: { agency: AgencyEmblemId; size?: number }) {
  if (agency === "police") return <NPFEmblem size={size} />;
  if (agency === "vio") return <VIOEmblem size={size} />;
  return <FRSCEmblem size={size} />;
}
