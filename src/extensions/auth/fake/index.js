import { getConfig } from "../../server/api/lib/config";

export const name = "fake";

export const getPassportStrategy = app => {};

export const serializedIdFromResult = strategyResult => {};

export const deserializeUser = async (serializedId, cookieDate) => {};

export const loginCallback = async (
  serializedId,
  cookieDate,
  saveNewUser
) => {};

export const publicClientDetails = () => {
  // return JSON-able that will be available in a public client global variable
  // DO NOT OUTPUT SECRETS: things like "CLIENT_ID" or "AUTH_DOMAIN" should be here
};

export const joinLinkToken = organization => {};
