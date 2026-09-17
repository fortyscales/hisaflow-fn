import React, { useState, useEffect, useMemo } from "react";
import { dataService } from "../services/DataService";
import { staffService } from "../services/staffService";
import StaffCard from "../components/StaffCard.jsx";
import StaffFormModal from "../components/StaffFormModal.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import { useLanguage } from "../context/LanguageContext.jsx";
import LoadingState from "../components/LoadingState.jsx";
import ScreenHeader from "../components/ScreenHeader.jsx";
import StickyScreenChrome from "../components/StickyScreenChrome.jsx";
import SearchInput from "../components/SearchInput.jsx";
import { searchService } from "../services/searchService";
import { UserCog } from "lucide-react";

const StaffScreen = () => {
  const { t } = useLanguage();
  const [staff, setStaff] = useState([]);
  const [staffSalesSummary, setStaffSalesSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadStaff = () =>
    dataService.getStaff().then((data) => {
      setStaff(data);
      setLoading(false);
    });

  useEffect(() => {
    loadStaff();
    dataService.getStaffSalesSummary().then(setStaffSalesSummary);
  }, []);

  const handleSave = async (data) => {
    const result = editingStaff
      ? await staffService.updateStaff(editingStaff.id, data)
      : await staffService.addStaff(data);
    if (result.success) {
      await loadStaff();
      setShowForm(false);
      setEditingStaff(null);
    }
    return result;
  };

  const confirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await staffService.deleteStaff(pendingDeleteId);
      await loadStaff();
      setPendingDeleteId(null);
    } catch (err) {
      console.error("Delete staff error:", err);
    } finally {
      setDeleting(false);
    }
  };

  const filteredStaff = useMemo(
    () => searchService.searchStaff(staff, searchQuery),
    [staff, searchQuery],
  );

  const salesByStaffId = useMemo(() => {
    const byId = {};
    staff.forEach((member) => {
      byId[member.id] = staffSalesSummary[member.name] || {
        cashCount: 0, cashRevenue: 0, creditCount: 0, creditRevenue: 0, totalCount: 0, totalRevenue: 0,
      };
    });
    return byId;
  }, [staff, staffSalesSummary]);

  if (loading) return <LoadingState />;

  return (
    <div style={styles.wrap}>
      <StickyScreenChrome>
        <ScreenHeader embedded Icon={UserCog} title={t("navStaff")} subtitle={t("staffScreenSubtitle")} actionLabel={t("addStaffButton")} onAction={() => { setEditingStaff(null); setShowForm(true); }} />
        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder={t("searchStaffPlaceholder")} style={{ marginBottom: 0 }} />
      </StickyScreenChrome>

      {filteredStaff.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {staff.length > 0 ? t("noMatchingStaffMessage") : t("noStaffYet")}
          </div>
          {staff.length === 0 && (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {t("tapAddStaffHint")}
            </div>
          )}
        </div>
      ) : (
        <div style={styles.grid}>
          {filteredStaff.map((s) => (
            <StaffCard
              key={s.id}
              staff={s}
              salesSummary={salesByStaffId[s.id]}
              onEdit={(member) => {
                setEditingStaff(member);
                setShowForm(true);
              }}
              onDelete={setPendingDeleteId}
            />
          ))}
        </div>
      )}

      <StaffFormModal
        visible={showForm}
        editingStaff={editingStaff}
        onSave={handleSave}
        onClose={() => {
          setShowForm(false);
          setEditingStaff(null);
        }}
      />

      <ConfirmModal
        visible={!!pendingDeleteId}
        message={t("confirmDeleteStaff")}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
        busy={deleting}
      />
    </div>
  );
};

const styles = {
  wrap: {
    flex: 1,
    overflow: "auto",
    padding: 28,
    maxWidth: 1080,
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 14,
  },
};

export default StaffScreen;


