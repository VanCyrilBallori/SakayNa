import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

// Public page (no login needed): https://sakay-na-delta.vercel.app/privacy
// DRAFT: the text below must be reviewed by the adviser before it is final.
const sections = [
  {
    heading: "1. About this policy",
    lines: [
      "SakayNa is a student Capstone project. It helps residents of Toledo City request community and emergency transport, and helps dispatchers and drivers respond.",
      "This page explains what information SakayNa collects, why we collect it, and how we protect it. We follow the Data Privacy Act of 2012 (Republic Act No. 10173) of the Philippines.",
    ],
  },
  {
    heading: "2. What information we collect",
    lines: [
      "When you sign up: your full name, email address, phone number, and barangay. Your password is handled by Firebase Authentication. We never see or store your password.",
      "When you sign in with Google: only your name and email address from your Google account. We do not get your Google password, contacts, or any other Google data.",
      "When you request transport: the pickup location (from your phone's GPS, a pin you place on the map, or an address you type), the destination, the passenger's name, a contact number, the type of service, and any notes you choose to add (for example, a description, accessibility needs, or whether the passenger needs extra care).",
      "When you send an emergency alert: your name, phone number, barangay, and your latest transport request. Right after the alert is sent, the app also attaches your GPS location (latitude, longitude, and address) so responders can find you, if your phone allows it.",
      "When you apply to be a driver: your full name, email address, phone number, barangay, and driver's license number. If you will use your own vehicle, we also collect the plate number, make, model, year, body type, color, MV file number, a photo of the OR/CR, and photos of the vehicle.",
      "Location: the app only gets your location when you use a feature that needs it, like filling in a pickup location or sending an emergency alert.",
    ],
  },
  {
    heading: "3. Why we use your information",
    lines: [
      "To create and manage your account.",
      "To send the right vehicle to the right place, and to let dispatchers and drivers contact you about your request.",
      "To respond to emergency alerts as quickly as possible.",
      "To review driver applications and check that drivers and vehicles are allowed to operate.",
      "To keep a record of requests for safety and reporting.",
    ],
  },
  {
    heading: "4. Who can see your information",
    lines: [
      "Only the people who need it to do their job in SakayNa: dispatchers, the driver assigned to your request, and system administrators.",
      "We do not sell your information, and we do not share it for advertising.",
    ],
  },
  {
    heading: "5. Where your information is stored",
    lines: [
      "Account and request information is stored in Google Firebase (Firebase Authentication and Cloud Firestore). Driver application photos are stored in Cloudinary. These services may keep data on servers outside the Philippines.",
    ],
  },
  {
    heading: "6. How we protect your information",
    lines: [
      "You must log in to use SakayNa. Security rules in our database limit each account to only the information its role needs. Passwords are handled by Firebase and are never stored by SakayNa.",
    ],
  },
  {
    heading: "7. How long we keep your information (DRAFT - to be decided)",
    lines: [
      "We keep your account information while your account is active.",
      "Transport request and emergency alert records are kept for [time period to be decided] for safety and reporting.",
      "Rejected driver applications, including their photos, are deleted after [time period to be decided].",
      "If you ask us to delete your account, we will delete or anonymize your information within [time period to be decided], unless the law requires us to keep it longer.",
    ],
  },
  {
    heading: "8. Your rights",
    lines: [
      "Under the Data Privacy Act of 2012, you have the right to be informed, to access your information, to correct it, to object to its use, to ask us to delete or block it, and to get a copy of it.",
      "To use any of these rights, contact us using the email below. You may also file a complaint with the National Privacy Commission (privacy.gov.ph).",
    ],
  },
  {
    heading: "9. Changes to this policy",
    lines: ["We may update this policy. When we do, we will change the date at the top of this page."],
  },
  {
    heading: "10. Contact us",
    lines: ["Email: sakayna.toledo@gmail.com"],
  },
];

export default function PrivacyPolicy() {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.draftBox}>
          <Text style={styles.draftText}>DRAFT - for adviser review. This page is not final and is not legal advice.</Text>
        </View>

        <Text style={styles.title}>SakayNa Privacy Policy</Text>
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

        <Link href="/terms" style={styles.link}>
          Read our Terms of Service
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
