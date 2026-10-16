import React from "react";

interface UnsavedChangesModalProps {
  isOpen: boolean;
  pageName: string;
  isSaving: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  pageName,
  isSaving,
  onCancel,
  onDiscard,
  onSave,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="confirm-dialog-card"
        style={{ maxWidth: 440 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="confirm-dialog-title">Unsaved Changes</div>
        <div
          className="confirm-dialog-body"
          style={{ color: "var(--text-secondary)", lineHeight: 1.5, margin: "12px 0 20px" }}
        >
          You have unsaved changes in <strong>{pageName}</strong>. Would you like to save your
          changes before leaving this section?
        </div>
        <div
          className="confirm-dialog-actions"
          style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}
        >
          <button
            type="button"
            className="btn-dialog-cancel"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-dialog-discard"
            onClick={onDiscard}
            disabled={isSaving}
          >
            Discard
          </button>
          <button
            type="button"
            className="btn-dialog-save"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save & Continue"}
          </button>
        </div>
      </div>
    </div>
  );
};
