import { ROLES, ROLE_OPTIONS } from "../constants/app";

export { ROLE_OPTIONS };

export const getRoleRoute = (role) => {
  switch (role) {
    case ROLES.DRIVER:
      return "/driver-home";
    case ROLES.ADMIN:
      return "/admin-home";
    case ROLES.DISPATCHER:
      return "/dispatcher-home";
    case ROLES.RESIDENT:
    default:
      return "/resident-home";
  }
};
