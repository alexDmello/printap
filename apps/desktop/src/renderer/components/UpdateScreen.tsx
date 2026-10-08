import React from "react";

interface UpdateScreenProps {
  stage: "checking" | "available" | "downloading" | "downloaded" | "error" | "not-available";
  progress?: number;
  error?: string;
  onRestart: () => void;
  onDismiss: () => void;
}

export function UpdateScreen({ stage, progress, error, onRestart, onDismiss }: UpdateScreenProps) {
  // If no update is available or still silently checking, we might not want to block the screen.
  // Actually, we'll only render this component in App.tsx if stage is available, downloading, downloaded, or error.
  
  return (
    <div className="fixed inset-0 bg-[#0f0f11]/90 flex flex-col items-center justify-center z-50 text-white font-sans backdrop-blur-sm">
      <div className="bg-[#1c1c1f] p-8 rounded-2xl shadow-2xl border border-white/5 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-500/20">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
        </div>

        <h2 className="text-2xl font-semibold mb-2">
          {stage === "checking" && "Checking for Updates..."}
          {stage === "available" && "Update Available"}
          {stage === "downloading" && "Downloading Update..."}
          {stage === "downloaded" && "Ready to Install"}
          {stage === "error" && "Update Error"}
        </h2>

        <p className="text-gray-400 mb-8 text-sm">
          {stage === "checking" && "Please wait while we check for the latest version."}
          {stage === "available" && "A new version of Printap is available. Preparing download..."}
          {stage === "downloading" && "Please do not close the app while the update is downloading."}
          {stage === "downloaded" && "The update has been downloaded. Restart the app to apply the changes."}
          {stage === "error" && (error || "Something went wrong while trying to update.")}
        </p>

        {stage === "downloading" && (
          <div className="w-full bg-black/50 rounded-full h-3 mb-4 overflow-hidden border border-white/10">
            <div 
              className="bg-blue-500 h-full transition-all duration-300 ease-out relative"
              style={{ width: `${progress || 0}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>
        )}

        {stage === "downloaded" && (
          <button
            onClick={onRestart}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-4 rounded-xl transition-colors shadow-lg shadow-blue-500/20"
          >
            Restart & Install
          </button>
        )}
        
        {stage === "error" && (
          <button
            onClick={onDismiss}
            className="w-full bg-white/10 hover:bg-white/20 text-white font-medium py-3 px-4 rounded-xl transition-colors"
          >
            Continue to App
          </button>
        )}
      </div>
    </div>
  );
}
