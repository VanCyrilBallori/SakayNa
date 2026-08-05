import { ACCOUNT_STATUSES, ROLES, ROLE_OPTIONS } from "../constants/app";

export { ROLE_OPTIONS };

export const isSupportedRole = (role) => ROLE_OPTIONS.includes(role);

export const isDisabledProfile = (profile) => profile?.accountStatus === ACCOUNT_STATUSES.DEACTIVATED;

export const isApprovedDriver = (profile) =>
  profile?.role === ROLES.DRIVER && profile?.accountStatus === ACCOUNT_STATUSES.APPROVED;

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

  if (profile.role !== ROLES.DRIVER && [ACCOUNT_STATUSES.PENDING, ACCOUNT_STATUSES.REJECTED].includes(profile.accountStatus)) {
    return null;
  }

  if (profile.role === ROLES.DRIVER) {
    return isApprovedDriver(profile) ? "/driver-home" : "/driver-status";
  }

  return getRoleRoute(profile.role);
};