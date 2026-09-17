import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
} from "react";
import translationsDict, { translate } from "../i18n/translations.js";
import { dataService } from "../services/DataService";

const LanguageContext = createContext({
  language: "sw",
  t: (key, params) => translate(translationsDict.sw, key, params),
  setLanguage: () => {},
});

export const LanguageProvider = ({ initialLanguage, children }) => {
  const [language, setLanguageState] = useState(initialLanguage || "sw");

  const setLanguage = useCallback(async (lang, currentSettings) => {
    setLanguageState(lang);
    // Persisted immediately so the choice survives closing the app —
    // same expectation as the phone app's language setting.
    const updated = { ...currentSettings, language: lang };
    await dataService.saveSettings(updated);
  }, []);

  const value = useMemo(() => {
    const dict = translationsDict[language] || translationsDict.sw;
    return {
      language,
      t: (key, params) => translate(dict, key, params),
      setLanguage,
    };
  }, [language, setLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);


