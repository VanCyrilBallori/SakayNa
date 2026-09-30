import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import PageBackButton from "../components/PageBackButton";

// Public page (no login needed): https://sakay-na-delta.vercel.app/privacy
// DRAFT: the text below must be reviewed by the adviser before it is final.
const sections = [
  {
    heading: "1. About this policy",
    lines: [
      "SakayNa is a student Capstone project. It helps residents of Toledo City request transport and send emergency alerts, and helps dispatchers and drivers respond.",
      "This page explains what information SakayNa collects, why we collect it, and how we protect it. We follow the Data Privacy Act of 2012 (Republic Act No. 10173) of the Philippines.",
    ],
  },
  {
    heading: "2. What information we collect",
    lines: [
      "When you sign up with email: your email address and a password. Your password is handled by Firebase Authentication. We never see or store your password.",
      "When you sign in with Google: only your name and email address from your Google account. We do not get your Google password, contacts, or any other Google data.",
      "When you request transport: what the ride is for, when you need it (as soon as possible, or a day and time you schedule up to 7 days ahead), who is riding (you or someone else) with their name and contact number, how many people are riding, the pickup location (your barangay, and if you choose, your phone's GPS or a pin you place on the map), a landmark, the destination, any help the passenger needs (for example, senior citizen, PWD or wheelchair user, pregnant, child), and any notes you choose to add.",
      "When you send an emergency alert: your name, phone number, barangay, and your latest transport request. Right after the alert is sent, the app also attaches your GPS location (latitude, longitude, and address) so responders can find you, if your phone allows it.",
      "When you register as a resident: your full name, phone number, barangay, and address (house number, street, or purok). You also send one photo that proves you live in your barangay (a Barangay Certificate of Residency, a Barangay ID, or another government document that shows your address), and you say which document it is.",
      "When you apply to be a driver: your full name, date of birth, contact number, barangay, address, and a profile picture. You also send photos of your documents: your Professional Driver's License (front and back, with its number and expiration date), your NBI Clearance or Police Clearance, your Medical Certificate, and, if you choose to, your Drug Test Clearance. Some of these documents, like the medical certificate, contain sensitive personal information.",
      "SakayNa does not collect any vehicle information from drivers. Vehicles belong to the barangay.",
      "Location: the app only uses your location if you allowed it on your phone. The home screen map shows where you are, but that position is not saved. Your location is only saved when you choose to use it for a pickup, or when you send an emergency alert.",
    ],
  },
  {
    heading: "3. Why we use your information",
    lines: [
      "To create and manage your account.",
      "To send the right vehicle to the right place, and to let dispatchers and drivers contact you about your request.",
      "To respond to emergency alerts as quickly as possible.",
      "To check that residents live in their barangay before they can send emergency alerts or transport requests.",
      "To review driver applications and check that drivers are allowed to drive.",
      "To keep a record of requests for safety and reporting.",
    ],
  },
  {
    heading: "4. Who can see your information",
    lines: [
      "Only the people who need it to do their job in SakayNa: dispatchers, the driver assigned to your request, and system administrators.",
      "The driver assigned to your request sees the passenger's name and contact number, the pickup location and landmark, the destination, the help the passenger needs, and your notes, so they can find and call the passenger.",
      "Your proof-of-residency photo and your driver documents can only be opened in SakayNa by you and by the administrator of your barangay, who reviews them. Dispatchers and drivers cannot see them.",
      "Please note: the photos are stored as web links. Anyone who has the exact link can open the photo, but SakayNa only shows these links to you and your barangay's administrator.",
      "We do not sell your information, and we do not share it for advertising.",
    ],
  },
  {
    heading: "5. Where your information is stored",
    lines: [
      "Account and request information is stored in Google Firebase (Firebase Authentication and Cloud Firestore). Proof-of-residency photos and driver document photos are stored in Cloudinary. These services may keep data on servers outside the Philippines.",
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
      "Proof-of-residency photos and driver document photos are kept after they are reviewed, so an administrator can check them again. They are deleted after [time period to be decided].",
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
        <PageBackButton />

        <View style={styles.draftBox}>
          <Text style={styles.draftText}>DRAFT - for adviser review. This page is not final and is not legal advice.</Text>
        </View>

        <Text style={styles.title}>SakayNa Privacy Policy</Text>
        <Text style={styles.updated}>Last updated: September 30, 2026 (draft)</Text>

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
