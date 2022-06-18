import passport from "passport";
import { getConfig } from "../../server/api/lib/config";
import { r } from "../../server/models";
import wrap from "../../server/wrap";

const CONFIGURED = getEnabled();

// TODO NEXT STEPS
// 1. can we 'merge' the loginCallbacks array?  need to figure out the 'next'-arg logic
// 2. move src/client/auth-service.js into */react-component.js for login/logout
//    -- handle BASE_URL (fallback to proto:host, but USE BASE_URL if available -- for security proxy defense
// 3. port slack and local
// 4. sessions in cache?

function completeUserSerialization(user, done, auth) {
  // MUST be called from passport strategy.
  // TODO: what is this for??
  // need to add auth to serialization
  done(null, user);
}

export const nextUrlRedirect = (nextUrl, defaultPath) =>
  nextUrl && !nextUrl.startsWith("http") ? nextUrl : defaultPath || "/";

export function passportSetup(app) {
  const strategies = (getConfig("PASSPORT_STRATEGY") || "auth0").split(",");
  strategies.forEach((auth, i) => {
    const authExtension = CONFIGURED[auth];
    const strategy = authExtension.getPassportStrategy(app, (user, done) =>
      completeUserSerialization(user, done, auth)
    );
    if (strategy) {
      passport.use(strategy);
    }

    if (authExtension.getLoginCallbacks) {
    }
  });
  passport.serializeUser((strategyResult, done) => {
    // The problem with bare passport serlialization is that it doesn't
    // change ever, so we force the date in the expiration
    console.log("passport.serializeUser", strageyResult);
    const auth = strategyResult && strategyResult.auth;
    if (!auth) {
      throw new Error(
        "Auth extension misconfigured" +
          "-- needs to call completeUserSerialization" +
          " from Passport Strategy initialization"
      );
    }
    const authExtension = CONFIGURED[auth];
    const strategyId = authExtension.serializedIdFromResult(strategyResult);
    const serializedDate = Number(new Date());
    const serializedCookieValue = `${auth}!${serializedDate}!${strategyId}`;
    // TODO: maybe save to session cache for validation -- needs async
    done(null, serializedCookieValue);
  });
  passport.deserializeUser(
    wrap(async (serializedCookieValue, done) => {
      const splitValues = serializedCookieValue.match(/^([^|]+)\!(\d+)\!(.+)$/);
      if (
        !splitValues ||
        !CONFIGURED[splitValues[1]] ||
        splitValues.length != 4
      ) {
        done(null, false);
      }
      const [_, authService, serializedDate, serializedId] = splitValues;
      const cookieDate = new Date(Number(serializedDate));
      // TODO: check cookieDate AND/OR validate session in redis
      // MAYBE TODO: have a deprecated legacy mode that allows old cookie continuation (temporarily)
      const user = await CONFIGURED[authService].deserializeUser(
        serializedId,
        cookieDate
      );
      done(null, user || false);
    })
  );
}

function getEnabled() {
  const enabled = (getConfig("PASSPORT_STRATEGY") || "auth0").split(",");
  const loaded = {};
  enabled.forEach(name => {
    try {
      const c = require(`./${name}/index.js`);
      loaded[name] = c;
    } catch (err) {
      console.error("PASSPORT_STRATEGY failed to load", name, err);
    }
  });
  return loaded;
}
