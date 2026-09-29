import React, { useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { getCustomerPrintUrl, ROOT_DOMAIN } from "@printap/shared";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import {
  IconQr,
  IconCopy,
  IconCheck,
  IconPrinter,
  IconShield,
} from "./Icons";

export const CounterQr: React.FC = () => {
  const { shop, shopId } = useAuth();
  const [copiedLink, setCopiedLink] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const qrCanvasRef = useRef<HTMLDivElement>(null);
  const qrSvgRef = useRef<HTMLDivElement>(null);

  // Canonical customer print URL on mellod.in
  const targetUrl = React.useMemo(() => {
    if (shop?.slug) return getCustomerPrintUrl(shop.slug);
    if (shopId) return getCustomerPrintUrl(shopId);
    return "";
  }, [shop?.slug, shopId]);

  const copyToClipboard = () => {
    if (!targetUrl) return;
    navigator.clipboard.writeText(targetUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // 1. Download Raw QR Code as PNG (1024x1024)
  const downloadRawQrPng = () => {
    const canvas = qrCanvasRef.current?.querySelector("canvas");
    if (!canvas) return;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = 1024;
    exportCanvas.height = 1024;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 1024, 1024);
    ctx.drawImage(canvas, 64, 64, 896, 896);

    const link = document.createElement("a");
    const safeShopName = (shop?.name || "Shop").replace(/[^a-z0-9]/gi, "_");
    link.download = `Printap_QR_${safeShopName}.png`;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  };

  // 2. Download Raw Vector QR Code as SVG
  const downloadRawQrSvg = () => {
    const svgEl = qrSvgRef.current?.querySelector("svg");
    if (!svgEl) return;

    const svgXml = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgXml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    const safeShopName = (shop?.name || "Shop").replace(/[^a-z0-9]/gi, "_");
    link.download = `Printap_QR_${safeShopName}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 3. Download Full Printable Standee Poster (High-Res 1200x1600)
  const downloadStandeePoster = () => {
    setIsExporting(true);
    const canvas = qrCanvasRef.current?.querySelector("canvas");
    if (!canvas) {
      setIsExporting(false);
      return;
    }

    const W = 1200;
    const H = 1600;
    const poster = document.createElement("canvas");
    poster.width = W;
    poster.height = H;
    const ctx = poster.getContext("2d");
    if (!ctx) {
      setIsExporting(false);
      return;
    }

    // Clean white base with subtle border
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Modern dark header band
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, W, 220);

    // Header Branding
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🖨️ PRINTAP SELF-SERVICE COUNTER", W / 2, 95);

    ctx.fillStyle = "#a1a1aa";
    ctx.font = "500 22px Inter, sans-serif";
    ctx.fillText("SCAN WITH PHONE • CHOOSE PDF • COLLECT PRINT", W / 2, 145);

    // Shop Name Banner
    ctx.fillStyle = "#09090b";
    ctx.font = "bold 54px Inter, sans-serif";
    ctx.fillText(shop?.name || "Printap Counter", W / 2, 330);

    ctx.fillStyle = "#52525b";
    ctx.font = "500 24px Inter, sans-serif";
    ctx.fillText("Skip the line — beam documents directly to our printer", W / 2, 385);

    // QR Code Frame (Rounded Card Box)
    const qrBoxSize = 620;
    const qrBoxX = (W - qrBoxSize) / 2;
    const qrBoxY = 440;

    ctx.fillStyle = "#f8fafc";
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 28);
    ctx.fill();
    ctx.stroke();

    // Draw QR image centered
    const qrDrawSize = 520;
    const qrDrawOffset = (qrBoxSize - qrDrawSize) / 2;
    ctx.drawImage(canvas, qrBoxX + qrDrawOffset, qrBoxY + qrDrawOffset, qrDrawSize, qrDrawSize);

    // 3 Step Guide Container
    const stepsY = 1110;
    ctx.fillStyle = "#09090b";
    ctx.font = "bold 30px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("HOW IT WORKS", W / 2, stepsY);

    const steps = [
      { num: "1", title: "Scan QR", desc: "Open phone camera" },
      { num: "2", title: "Select PDF", desc: "Choose B&W or Color" },
      { num: "3", title: "Collect Print", desc: "Instant spool & shred" },
    ];

    const colWidth = W / 3;
    steps.forEach((step, idx) => {
      const cx = colWidth * idx + colWidth / 2;
      const cy = stepsY + 60;

      // Circle badge
      ctx.fillStyle = "#09090b";
      ctx.beginPath();
      ctx.arc(cx, cy, 28, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 24px Inter, sans-serif";
      ctx.fillText(step.num, cx, cy + 8);

      // Title & desc
      ctx.fillStyle = "#09090b";
      ctx.font = "bold 24px Inter, sans-serif";
      ctx.fillText(step.title, cx, cy + 65);

      ctx.fillStyle = "#71717a";
      ctx.font = "400 20px Inter, sans-serif";
      ctx.fillText(step.desc, cx, cy + 98);
    });

    // Footer divider & UPI info
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 1370);
    ctx.lineTo(W - 100, 1370);
    ctx.stroke();

    ctx.fillStyle = "#059669";
    ctx.font = "bold 26px 'Geist Mono', monospace";
    ctx.fillText(`Direct UPI: ${shop?.upi_vpa || "shop@upi"}`, W / 2, 1430);

    ctx.fillStyle = "#a1a1aa";
    ctx.font = "400 20px Inter, sans-serif";
    ctx.fillText("Zero Cloud Storage Liability • Peer-to-Peer Encrypted WebRTC", W / 2, 1480);

    // Download poster
    const link = document.createElement("a");
    const safeShopName = (shop?.name || "Shop").replace(/[^a-z0-9]/gi, "_");
    link.download = `Printap_Counter_Standee_${safeShopName}.png`;
    link.href = poster.toDataURL("image/png");
    link.click();
    setIsExporting(false);
  };

  return (
    <div className="content fade-in">
      {/* Page Header */}
      <div
        className="page-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1 className="page-title">
            <span>Counter QR Stand</span>
            <span className="status-badge active">Print Ready • 300 DPI</span>
          </h1>
          <p className="page-subtitle">
            Generate, customize, and export printable acrylic counter standees and high-resolution QR codes.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="button"
            className="btn-ghost"
            onClick={copyToClipboard}
          >
            {copiedLink ? (
              <>
                <IconCheck size={13} color="var(--accent-emerald)" />
                <span style={{ color: "var(--accent-emerald)" }}>Copied</span>
              </>
            ) : (
              <>
                <IconCopy size={13} />
                <span>Copy Print Link</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="login-btn"
            style={{ width: "auto", margin: 0, padding: "8px 18px" }}
            onClick={downloadStandeePoster}
            disabled={isExporting}
          >
            <IconQr size={15} />
            <span>{isExporting ? "Generating..." : "Download Standee"}</span>
          </button>
        </div>
      </div>

      {/* Subdomain Destination Banner */}
      <div
        className="card"
        style={{
          marginBottom: 24,
          padding: 20,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
              Dedicated Shop Subdomain
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              Customer print requests route directly to your dedicated subdomain on {ROOT_DOMAIN}.
            </div>
          </div>
          <span className="status-badge active" style={{ fontSize: 11 }}>
            ● Production Ready
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(255, 255, 255, 0.7)",
            padding: "10px 16px",
            borderRadius: "var(--radius-full)",
            border: "1px solid var(--border-subtle)",
            fontSize: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ color: "var(--accent-emerald)", fontWeight: 700 }}>● Destination:</span>
            <span style={{ color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "Geist Mono, monospace", fontWeight: 500 }}>
              {targetUrl}
            </span>
          </div>

          <button
            type="button"
            className="btn-ghost"
            style={{ padding: "4px 10px", fontSize: 11, marginLeft: 12 }}
            onClick={copyToClipboard}
          >
            {copiedLink ? "✓ Copied" : "Copy URL"}
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout: Standee Preview & Download Options */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24, alignItems: "start" }}>
        {/* Left Column: Visual Counter Standee Card Preview */}
        <div className="card" style={{ padding: 22 }}>
          <div className="card-header" style={{ padding: "0 0 16px 0", marginBottom: 18 }}>
            <div className="card-title">Live Standee Preview</div>
            <span className="status-badge active">
              Ready to Print • A5 / 5×7"
            </span>
          </div>

          {/* Curved Acrylic Standee Mockup Card */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid rgba(0, 0, 0, 0.08)",
              borderRadius: "var(--radius-2xl)",
              padding: "28px 24px",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.06)",
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Top Accent Strip */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 6,
                background: "#09090b",
              }}
            />

            {/* Standee Branding Header */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  marginBottom: 4,
                }}
              >
                PRINTAP SELF-SERVICE COUNTER
              </div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#09090b",
                  letterSpacing: "-0.02em",
                }}
              >
                {shop?.name || "Printap Counter"}
              </h2>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                Scan with your phone camera to beam documents
              </div>
            </div>

            {/* Centered QR Canvas Box */}
            <div
              ref={qrCanvasRef}
              style={{
                display: "inline-block",
                padding: 16,
                background: "#f8fafc",
                borderRadius: "var(--radius-xl)",
                border: "1px solid var(--border-subtle)",
                boxShadow: "0 4px 14px rgba(0, 0, 0, 0.04)",
                margin: "8px auto 16px",
              }}
            >
              <QRCodeCanvas
                value={targetUrl}
                size={200}
                level="H"
                includeMargin={false}
              />
            </div>

            {/* Hidden SVG ref for vector download */}
            <div ref={qrSvgRef} style={{ display: "none" }}>
              <QRCodeSVG value={targetUrl} size={1024} level="H" />
            </div>

            {/* 3 Step Visual Guide */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
                background: "#f8fafc",
                padding: "12px 8px",
                borderRadius: "var(--radius-lg)",
                marginTop: 6,
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#09090b" }}>1. Scan</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Open camera</div>
              </div>
              <div style={{ borderLeft: "1px solid #e2e8f0", borderRight: "1px solid #e2e8f0" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#09090b" }}>2. Select PDF</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Choose B&W / Color</div>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#09090b" }}>3. Print</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Instant spool</div>
              </div>
            </div>

            {/* Standee Footer */}
            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: "1px solid #f1f5f9",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: 11,
              }}
            >
              <span style={{ fontWeight: 600, color: "#059669", fontFamily: "Geist Mono, monospace" }}>
                UPI: {shop?.upi_vpa || "shop@upi"}
              </span>
              <span style={{ color: "var(--text-muted)" }}>Powered by Printap</span>
            </div>
          </div>
        </div>

        {/* Right Column: Download Actions & Assets */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Card: Export Options */}
          <div className="card" style={{ padding: 22 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
              Download Ready-to-Use Assets
            </div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
              Export high-resolution materials for acrylic stands, laminated table cards, or stickers.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Option 1: Full Standee Poster */}
              <div
                style={{
                  padding: "14px 18px",
                  background: "rgba(255, 255, 255, 0.7)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-lg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    Printable Counter Standee (PNG)
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    1200×1600 300 DPI Poster with Steps & UPI
                  </div>
                </div>
                <button
                  type="button"
                  className="login-btn"
                  style={{ width: "auto", padding: "7px 16px", fontSize: 12 }}
                  onClick={downloadStandeePoster}
                  disabled={isExporting}
                >
                  Download Standee
                </button>
              </div>

              {/* Option 2: Raw QR PNG */}
              <div
                style={{
                  padding: "14px 18px",
                  background: "rgba(255, 255, 255, 0.7)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-lg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    Square QR Code (PNG)
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    1024×1024 Raster image
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={downloadRawQrPng}
                >
                  Save PNG
                </button>
              </div>

              {/* Option 3: Raw QR SVG Vector */}
              <div
                style={{
                  padding: "14px 18px",
                  background: "rgba(255, 255, 255, 0.7)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-lg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                    Vector QR Code (SVG)
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    Scalable vector graphic for signage
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={downloadRawQrSvg}
                >
                  Save SVG
                </button>
              </div>
            </div>
          </div>

          {/* Card: Acrylic Display Recommendations */}
          <div
            className="card"
            style={{
              padding: 20,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: 6,
              }}
            >
              Counter Display Recommendations
            </div>
            <p
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                lineHeight: 1.6,
              }}
            >
              • Stand Type: 5×7" or A5 clear vertical acrylic L-stand or T-stand.
              <br />
              • Print Paper: 250 GSM heavy cardstock for optimal camera contrast.
              <br />
              • Counter Placement: Position directly facing customer queue line, 15-30cm from counter edge.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
