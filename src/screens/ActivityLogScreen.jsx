import React, { useState, useEffect, useMemo } from "react";
import { dataService } from "../services/DataService";
import { useLanguage } from "../context/LanguageContext.jsx";
import LoadingState from "../components/LoadingState.jsx";
import ScreenHeader from "../components/ScreenHeader.jsx";
import StickyScreenChrome from "../components/StickyScreenChrome.jsx";
import SearchInput from "../components/SearchInput.jsx";
import { searchService } from "../services/searchService";
import { History } from "lucide-react";

const formatDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("sw-TZ", { day: "numeric", month: "short" }) +
    " · " +
    d.toLocaleTimeString("sw-TZ", { hour: "2-digit", minute: "2-digit" })
  );
};

const ActivityLogScreen = () => {
  const { t } = useLanguage();
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    dataService.getActivityLog().then((data) => {
      setLog(data);
      setLoading(false);
    });
  }, []);

  const sorted = useMemo(
    () =>
      searchService
        .searchActivityLog(log, searchQuery)
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date)),
    [log, searchQuery],
  );

  if (loading) return <LoadingState />;

  return (
    <div style={styles.wrap}>
      <StickyScreenChrome>
        <ScreenHeader embedded Icon={History} title={t("navActivityLog")} subtitle={t("activityLogHint")} />
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder={t("searchActivityLogPlaceholder")} style={{ marginBottom: 0 }} />
      </StickyScreenChrome>

      {sorted.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontWeight: 700 }}>
            {log.length > 0
              ? t("noMatchingActivityMessage")
              : t("noActivityYet")}
          </div>
        </div>
      ) : (
        <div style={styles.panel}>
          {sorted.map((entry) => (
            <div key={entry.id} style={styles.row}>
              <div style={styles.avatar}>
                {(entry.actorName || "?").charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.actionLine}>
                  <span style={styles.actorName}>{entry.actorName}</span>{" "}
                  {entry.action}
                </div>
                {entry.details && (
                  <div style={styles.details}>{entry.details}</div>
                )}
              </div>
              <div style={styles.date}>{formatDateTime(entry.date)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  wrap: {
    flex: 1,
    overflow: "auto",
    padding: 28,
    maxWidth: 780,
    margin: "0 auto",
    width: "100%",
  },
  emptyState: {
    background: "var(--surface)",
    border: "1px solid var(--border-muted)",
    borderRadius: 18,
    padding: 48,
    textAlign: "center",
  },
  panel: {
    background: "var(--surface)",
    border: "1px solid var(--border-muted)",
    borderRadius: 18,
    overflow: "hidden",
  },
  row: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "14px 18px",
    borderBottom: "1px solid var(--border-muted)",
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 999,
    background: "var(--primary-light)",
    color: "var(--primary-dark)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 800,
    flexShrink: 0,
  },
  actionLine: { fontSize: 13, color: "var(--text-primary)" },
  actorName: { fontWeight: 800 },
  details: { fontSize: 12, color: "var(--text-muted)", marginTop: 2 },
  date: {
    fontSize: 11,
    color: "var(--text-muted)",
    flexShrink: 0,
    whiteSpace: "nowrap",
  },
};

export default ActivityLogScreen;


