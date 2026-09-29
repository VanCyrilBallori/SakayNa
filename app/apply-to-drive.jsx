import { Redirect } from "expo-router";

import ScreenState from "../components/ui/ScreenState";
import { getPostAuthenticationRoute } from "../lib/roles";
import { useCurrentUserProfile } from "../lib/session";

// /apply-to-drive (the website's "Apply to Drive" link) is only a signpost now.
// It shows no form. It sends each person to the right place in the new sign-up flow:
// - Not logged in → Create Account. After verifying the email, they choose Driver on Choose Role.
// - Logged in, no profile yet → Verify Email, or the driver form if the email is already verified.
// - Already has an account → their own home.
export default function ApplyToDrive() {
  const { authUser, authStatus, profile, profileStatus } = useCurrentUserProfile();

  if (authStatus !== "ready" || (authUser && (profileStatus === "idle" || profileStatus === "loading"))) {
    return <ScreenState loading message="Loading..." />;
  }

  if (!authUser) {
    return <Redirect href="/signup" />;
  }

  if (profileStatus === "missing") {
    return <Redirect href={authUser.emailVerified ? "/register-driver" : "/verify-email"} />;
  }

  return <Redirect href={getPostAuthenticationRoute(profile) ?? "/"} />;
}
