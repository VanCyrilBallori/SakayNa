import { ACCOUNT_STATUSES, ROLES, ROLE_OPTIONS } from "../constants/app";

export { ROLE_OPTIONS };

export const isSupportedRole = (role) => ROLE_OPTIONS.includes(role);

export const isDisabledProfile = (profile) => profile?.accountStatus === ACCOUNT_STATUSES.DEACTIVATED;

export const isApprovedDriver = (profile) =>
  profile?.role === ROLES.DRIVER && profile?.accountStatus === ACCOUNT_STATUSES.APPROVED;

// The words saved in Firestore stay the same. This only picks a friendlier name to show on screen.
export const getAccountStatusLabel = (profile) => {
  const status = profile?.accountStatus;

  if (status === ACCOUNT_STATUSES.PENDING) {
    return profile?.role === ROLES.DRIVER ? "Pending Review" : "Pending Verification";
  }

  if (status === ACCOUNT_STATUSES.ACTIVE && profile?.role === ROLES.RESIDENT) {
    return "Verified Resident";
  }

  if (status === ACCOUNT_STATUSES.APPROVED && profile?.role === ROLES.DRIVER) {
    return "Verified Driver";
  }

  return status || "";
};

export const getRoleRoute = (role) => {
  switch (role) {
    case ROLES.DRIVER:
      return "/driver-home";
    case ROLES.ADMIN:
      return "/admin-home";
    case ROLES.DISPATCHER:
      return "/dispatcher-home";
    case ROLES.RESIDENT:
      return "/resident-home";
    default:
      return null;
  }
};

export const getPostAuthenticationRoute = (profile) => {
  if (!profile || !isSupportedRole(profile.role) || isDisabledProfile(profile)) {
    return null;
  }

  // Pending or Rejected Dispatcher/Admin accounts may not go in. Pending or Rejected Residents may:
  // they wait for an Admin to verify them inside the app. Drivers are handled just below.
  if (![ROLES.DRIVER, ROLES.RESIDENT].includes(profile.role) && [ACCOUNT_STATUSES.PENDING, ACCOUNT_STATUSES.REJECTED].includes(profile.accountStatus)) {
    return null;
  }

  if (profile.role === ROLES.DRIVER) {
    return isApprovedDriver(profile) ? "/driver-home" : "/driver-status";
  }

  return getRoleRoute(profile.role);
};