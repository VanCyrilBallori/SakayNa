import { useState } from "react";
import { FontAwesome } from "@expo/vector-icons";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

import { RADIUS } from "../../constants/design";

export default function PasswordInput({ value, onChangeText, placeholder = "Password", editable = true, style, inputStyle, accessibilityLabel = "Password" }) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={[styles.wrap, style]}>
      <TextInput accessibilityLabel={accessibilityLabel} style={[styles.input, inputStyle]} placeholder={placeholder} placeholderTextColor="#8B8B8B" secureTextEntry={!visible} value={value} onChangeText={onChangeText} editable={editable} />
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={visible ? "Hide password" : "Show password"} accessibilityState={{ disabled: !editable }} disabled={!editable} onPress={() => setVisible((current) => !current)} style={styles.toggle}>
        <FontAwesome name={visible ? "eye-slash" : "eye"} size={19} color="#6F6F6F" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%", minHeight: 50, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#D7D7D7", borderRadius: RADIUS.md, backgroundColor: "#FCFCFC" },
  input: { flex: 1, minHeight: 50, paddingLeft: 14, paddingRight: 8, fontSize: 15, color: "#111111" },
  toggle: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
});