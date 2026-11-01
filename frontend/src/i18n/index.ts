import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ptBR from "./pt-BR.json";

export const DEFAULT_LANGUAGE = "pt-BR";

void i18n.use(initReactI18next).init({
  resources: {
    [DEFAULT_LANGUAGE]: { translation: ptBR },
  },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: [DEFAULT_LANGUAGE],
  interpolation: {
    // O React já escapa o conteúdo
    escapeValue: false,
  },
});

export default i18n;
