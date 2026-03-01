/**
 * Email OAuth Helpers Index
 *
 * Not: Her iki modülde de isTokenExpired fonksiyonu var.
 * Google'dan isTokenExpired, Microsoft'tan isMicrosoftTokenExpired olarak export ediliyor.
 */

// Google modülünden explicit export (isTokenExpired çakışmasını önlemek için)
export {
  getGoogleAuthUrl,
  exchangeGoogleCode,
  refreshGoogleToken,
  getGoogleUserInfo,
  parseGoogleState,
  isTokenExpired,
} from './google';

// Microsoft modülünden explicit export
export {
  getMicrosoftAuthUrl,
  exchangeMicrosoftCode,
  refreshMicrosoftToken,
  getMicrosoftUserInfo,
  parseMicrosoftState,
  isMicrosoftTokenExpired,
} from './microsoft';
