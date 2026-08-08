const { getApps, initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");

if (!getApps().length) initializeApp();

module.exports = { db: getFirestore(), auth: getAuth(), FieldValue };