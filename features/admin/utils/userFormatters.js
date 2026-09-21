export const getUserPhone = (user) => user.phoneNumber || user.phone || "Not provided";
export const getUserName = (user) => user.fullName || user.displayName || user.email || "Registered User";
export const getUserAddress = (user) => user.address || user.pickupDetails || "Not provided";
export const getApprovalStatus = (user) => user.accountStatus || user.approvalStatus || user.status || "Active";
export const getProfilePhoto = (record) => record.profilePhoto || record.photoURL || record.avatarUrl || "";
