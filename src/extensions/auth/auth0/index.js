import passport from "passport";
import { getConfig } from "../../../server/api/lib/config";
import Auth0Strategy from "passport-auth0";
import { User, cacheableData } from "./models";
import wrap from "../../../server/wrap";
import { capitalizeWord } from "./api/lib/utils";

// lookupString: auth0: auth0_id stuff, local: id, slack: slackLoginId(....)
//

export function getPassportStrategy(app, completeUserSerialization) {
  const domain = getConfig("AUTH0_DOMAIN");
  const clientID = getConfig("AUTH0_CLIENT_ID");
  const clientSecret = getConfig("AUTH0_CLIENT_SECRET");
  const baseUrl = getConfig("BASE_URL");
  const strategy = new Auth0Strategy(
    {
      domain,
      clientID,
      clientSecret,
      callbackURL: `${baseUrl}/login-callback`
    },
    (accessToken, refreshToken, extraParams, profile, done) =>
      // normally you would call done(null, profile) here
      // BUT completeUserSerialization MUST be called like this instead
      // the central auth app should complete the call
      completeUserSerialization(profile, done)
  );
  return strategy;
}

export function serializedIdFromResult(strategyResult) {
  const auth0Id = strategyResult.id || strategyResult._json.sub;
  return auth0Id;
}

export async function deserializeUser(serializedId, cookieDate) {
  const user = await cacheableData.user.userLoggedIn("auth0_id", id);
  return user;
}

export function setupAuth0Passport() {
  const strategy = new Auth0Strategy(
    {
      domain: process.env.AUTH0_DOMAIN,
      clientID: process.env.AUTH0_CLIENT_ID,
      clientSecret: process.env.AUTH0_CLIENT_SECRET,
      callbackURL: `${process.env.BASE_URL}/login-callback`
    },
    (accessToken, refreshToken, extraParams, profile, done) =>
      done(null, profile)
  );

  passport.use(strategy);

  passport.serializeUser((user, done) => {
    // This is the Auth0 user object, not the db one
    // eslint-disable-next-line no-underscore-dangle
    const auth0Id = user.id || user._json.sub;
    done(null, auth0Id);
  });

  passport.deserializeUser(
    wrap(async (id, done) => {
      // add new cacheable query
      const user = await cacheableData.user.userLoggedIn("auth0_id", id);
      done(null, user || false);
    })
  );

  return {
    loginCallback: [
      passport.authenticate("auth0", { failureRedirect: "/login" }),
      wrap(async (req, res) => {
        // eslint-disable-next-line no-underscore-dangle
        const auth0Id = req.user && (req.user.id || req.user._json.sub);
        if (!auth0Id) {
          throw new Error("Null user in login callback");
        }
        const existingUser = await User.filter({ auth0_id: auth0Id });

        if (existingUser.length === 0) {
          const userMetadata =
            // eslint-disable-next-line no-underscore-dangle
            req.user._json["https://spoke/user_metadata"] ||
            // eslint-disable-next-line no-underscore-dangle
            req.user._json.user_metadata ||
            {};
          const userData = {
            auth0_id: auth0Id,
            // eslint-disable-next-line no-underscore-dangle
            first_name: capitalizeWord(userMetadata.given_name) || "",
            // eslint-disable-next-line no-underscore-dangle
            last_name: capitalizeWord(userMetadata.family_name) || "",
            cell: userMetadata.cell || "",
            // eslint-disable-next-line no-underscore-dangle
            email: req.user._json.email,
            is_superadmin: false
          };
          const finalUser = await User.save(userData);
          if (finalUser && finalUser.id === 1) {
            await r
              .knex("user")
              .where("id", 1)
              .update({ is_superadmin: true });
          }
          res.redirect(nextUrlRedirect(req.query.state, "terms"));
          return;
        }
        res.redirect(nextUrlRedirect(req.query.state));
        return;
      })
    ]
  };
}

export default {
  local: setupLocalAuthPassport,
  auth0: setupAuth0Passport,
  slack: setupSlackPassport
};
