import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useIncidents, IncidentType, SeverityLevel, Vehicle, Victim, Incident } from "@/context/IncidentContext";
import { useColors } from "@/hooks/useColors";
import { NIGERIA_STATE_LGAS } from "@/data/nigeriaLGAs";

function Step2({ colors, form, update }: any) {
  const [locating, setLocating] = useState(false);
  const [lgaSearch, setLgaSearch] = useState("");

  return (
    <View style={{ gap: 16 }}>
      <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>LOCATION DETAILS</Text>

      <View style={[s.gpsBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        ...

      <View>
        <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>State</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          {NIGERIA_STATES.map((st) => (
            <TouchableOpacity key={st} style={[s.stateChip, { backgroundColor: form.state === st ? colors.primary : colors.muted, borderColor: form.state === st ? colors.primary : colors.border }]} onPress={() => update({ state: st, lga: "" })}>
              <Text style={[s.stateChipText, { color: form.state === st ? "#fff" : colors.mutedForeground }]}>{st}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View>
        <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>LGA</Text>
        {form.state ? (() => {
          const lgas = NIGERIA_STATE_LGAS.find((s) => s.name === form.state)?.lgas ?? [];
          const filtered = lgas.filter((l) => !lgaSearch || l.toLowerCase().includes(lgaSearch.toLowerCase()));
          return (
            <>
              {form.lga ? (
                <TouchableOpacity style={[s.lgaSelected, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]} onPress={() => update({ lga: "" })}>
                  <Feather name="map-pin" size={14} color={colors.primary} />
                  <Text style={[s.lgaSelectedText, { color: colors.primary }]}>{form.lga}</Text>
                  <Feather name="x" size={14} color={colors.primary} />
                </TouchableOpacity>
              ) : (
                <Text style={[s.lgaHint, { color: colors.mutedForeground }]}>Pick an LGA in {form.state}</Text>
              )}
              <View style={[s.lgaSearchBox, { borderColor: colors.border, backgroundColor: colors.muted }]}>
                <Feather name="search" size={13} color={colors.mutedForeground} />
                <TextInput
                  style={[s.lgaSearchInput, { color: colors.text }]}
                  placeholder={`Search ${lgas.length} LGAs…`}
                  placeholderTextColor={colors.mutedForeground}
                  value={lgaSearch}
                  onChangeText={setLgaSearch}
                />
                {lgaSearch ? (
                  <TouchableOpacity onPress={() => setLgaSearch("")}>
                    <Feather name="x" size={13} color={colors.mutedForeground} />
                  </TouchableOpacity>
                ) : null}
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 6 }}>
                {filtered.map((lga) => (
                  <TouchableOpacity key={lga} style={[s.stateChip, { backgroundColor: form.lga === lga ? colors.primary : colors.muted, borderColor: form.lga === lga ? colors.primary : colors.border }]} onPress={() => update({ lga })}>
                    <Text style={[s.stateChipText, { color: form.lga === lga ? "#fff" : colors.mutedForeground }]}>{lga}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          );
        })() : (
          <View style={[s.lgaDisabled, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="map" size={14} color={colors.mutedForeground} />
            <Text style={[s.lgaHint, { color: colors.mutedForeground }]}>Select a state first</Text>
          </View>
        )}
      </View>
    </View>
  );
}
