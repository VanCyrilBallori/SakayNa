export const ROLE_OPTIONS = ["Resident", "Driver", "Admin", "Dispatcher"];

export const getRoleRoute = (role) => {
  switch (role) {
    case "Driver":
      return "/driver-home";
    case "Admin":
      return "/admin-home";
    case "Dispatcher":
      return "/dispatcher-home";
    case "Resident":
    default:
      return "/resident-home";
  }
};
