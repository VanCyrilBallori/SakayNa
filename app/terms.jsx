import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

// Public page (no login needed): https://sakay-na-delta.vercel.app/terms
// DRAFT: the text below must be reviewed by the adviser before it is final.
const sections = [
  {
    heading: "1. About SakayNa",
    lines: [
      "SakayNa is a student Capstone project. It lets residents of Toledo City request community and emergency transport, and connects them with dispatchers, drivers, and administrators.",
      "By creating an account or using SakayNa, you agree to these terms.",
    ],
  },
  {
    heading: "2. SakayNa does not replace emergency hotlines",
    lines: [
      "In a life-threatening emergency, also call 911 or your local emergency hotline. SakayNa cannot promise that a vehicle will always be available or will arrive by a certain time.",
      "Accounts that are not yet verified cannot send emergency alerts or transport requests. If you have an emergency while your account is waiting for verification, call 911.",
    ],
  },
  {
    heading: "3. Your account",
    lines: [
      "Give true and correct information when you sign up and when you make a request.",
      "Keep your password safe. You are responsible for what is done using your account.",
    ],
  },
  {
    heading: "4. Using SakayNa properly",
    lines: [
      "Do not send fake, prank, or test transport requests or emergency alerts.",
      "Do not use other people's information without their permission.",
      "Do not try to access information you are not allowed to see, or try to break the app.",
      "Treat drivers, dispatchers, and other staff with respect.",
    ],
  },
  {
    heading: "5. Drivers",
    lines: [
      "Driver applicants must have a valid driver's license and must submit true and correct documents. Applications are reviewed and may be rejected.",
      "Approved drivers must follow traffic laws and drive safely.",
    ],
  },
  {
    heading: "6. Suspending accounts",
    lines: ["We may suspend or disable accounts that break these terms."],
  },
  {
    heading: "7. Your privacy",
    lines: ["Our Privacy Policy explains what information we collect and how we use it."],
  },
  {
    heading: "8. Availability of the service",
    lines: [
      "SakayNa is a student project. It is provided \"as is\" and may change, stop, or have errors at any time.",
    ],
  },
  {
    heading: "9. Changes to these terms",
    lines: ["We may update these terms. When we do, we will change the date at the top of this page."],
  },
  {
    heading: "10. Contact us",
    lines: ["Email: sakayna.toledo@gmail.com"],
  },
];

export default function TermsOfService() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.draftBox}>
          <Text style={styles.draftText}>DRAFT - for adviser review. This page is not final and is not legal advice.</Text>
        </View>

        <Text style={styles.title}>SakayNa Terms of Service</Text>
        <Text style={styles.updated}>Last updated: September 28, 2026 (draft)</Text>

        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.lines.map((line) => (
              <Text key={line} style={styles.paragraph}>
                {line}
              </Text>
            ))}
          </View>
        ))}

        <Link href="/privacy" style={styles.link}>
          Read our Privacy Policy
        </Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F6F7F3",
  },
  content: {
    padding: 16,
    paddingVertical: 32,
  },
  card: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  draftBox: {
    backgroundColor: "#FFF4CC",
    borderColor: "#E0B400",
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  draftText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#5C4600",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F6B4F",
  },
  updated: {
    marginTop: 6,
    fontSize: 13,
    color: "#5F6B78",
  },
  section: {
    marginTop: 24,
  },
  heading: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E352D",
  },
  paragraph: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 23,
    color: "#1E352D",
  },
  link: {
    marginTop: 32,
    fontSize: 15,
    fontWeight: "700",
    color: "#0F6B4F",
    textDecorationLine: "underline",
  },
});
